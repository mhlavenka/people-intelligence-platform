import jwt from 'jsonwebtoken';
import { DateTime } from 'luxon';
import { google } from 'googleapis';
import { config } from '../config/env';
import { AvailabilityConfig } from '../models/AvailabilityConfig.model';
import { BookingSettings } from '../models/BookingSettings.model';
import { Booking, IBooking } from '../models/Booking.model';
import { User } from '../models/User.model';
import { invalidateSlotCache } from './availability.service';
import {
  sendBookingConfirmation,
  sendCancellationEmail,
} from './bookingNotification.service';

// ─── Helpers ────────────────────────────────────────────────────────────────

function createOAuth2Client() {
  return new google.auth.OAuth2(
    config.oauth.google.clientId,
    config.oauth.google.clientSecret,
    config.oauth.google.calendarRedirectUri,
  );
}

async function getAuthenticatedClient(coachId: string) {
  const coach = await User.findById(coachId).select(
    '+googleCalendar.accessToken +googleCalendar.refreshToken',
  );
  if (!coach?.googleCalendar?.connected || !coach.googleCalendar.refreshToken) {
    throw new Error('Google Calendar not connected');
  }

  const client = createOAuth2Client();
  client.setCredentials({
    access_token: coach.googleCalendar.accessToken,
    refresh_token: coach.googleCalendar.refreshToken,
    expiry_date: coach.googleCalendar.tokenExpiry?.getTime(),
  });

  const now = Date.now();
  const expiry = coach.googleCalendar.tokenExpiry?.getTime() ?? 0;
  if (now >= expiry - 60_000) {
    const { credentials } = await client.refreshAccessToken();
    client.setCredentials(credentials);
    await User.findByIdAndUpdate(coachId, {
      'googleCalendar.accessToken': credentials.access_token,
      'googleCalendar.tokenExpiry': credentials.expiry_date
        ? new Date(credentials.expiry_date)
        : undefined,
    });
  }

  return client;
}

class SlotUnavailableError extends Error {
  statusCode = 409;
  constructor() {
    super('This time slot is no longer available');
    this.name = 'SlotUnavailableError';
  }
}

// ─── Slot validation ────────────────────────────────────────────────────────

async function isSlotFree(
  coachId: string,
  calendarIds: string[],
  start: Date,
  end: Date,
): Promise<boolean> {
  // Check existing bookings first
  const existingBooking = await Booking.findOne({
    coachId,
    status: 'confirmed',
    startTime: { $lt: end },
    endTime: { $gt: start },
  }).setOptions({ bypassTenantCheck: true });

  if (existingBooking) return false;

  // Check Google Calendar
  if (calendarIds.length) {
    try {
      const auth = await getAuthenticatedClient(coachId);
      const calendar = google.calendar({ version: 'v3', auth });
      const res = await calendar.freebusy.query({
        requestBody: {
          timeMin: start.toISOString(),
          timeMax: end.toISOString(),
          items: calendarIds.map((id) => ({ id })),
        },
      });

      const calendars = res.data.calendars ?? {};
      for (const calId of Object.keys(calendars)) {
        if ((calendars[calId]?.busy ?? []).length > 0) return false;
      }
    } catch (err) {
      console.error('[Booking] Failed to check Google freebusy:', err);
      // Continue — don't block booking if Google API fails
    }
  }

  return true;
}

// ─── Public API ─────────────────────────────────────────────────────────────

export async function createBooking(
  coachSlug: string,
  data: {
    startTime: string;
    endTime: string;
    clientName: string;
    clientEmail: string;
    clientPhone?: string;
    topic?: string;
    clientTimezone?: string;
  },
): Promise<IBooking> {
  const cfg = await AvailabilityConfig.findOne({ coachSlug, isActive: true })
    .setOptions({ bypassTenantCheck: true });
  if (!cfg) throw Object.assign(new Error('Booking not available'), { statusCode: 404 });

  const coach = await User.findById(cfg.coachId).select(
    'firstName lastName email +googleCalendar.accessToken +googleCalendar.refreshToken googleCalendar.connected googleCalendar.tokenExpiry googleCalendar.calendarId',
  );
  if (!coach) throw Object.assign(new Error('Coach not found'), { statusCode: 404 });

  // Load shared calendar settings
  const shared = await BookingSettings.findOne({ coachId: cfg.coachId })
    .setOptions({ bypassTenantCheck: true });
  const targetCalendarId = shared?.targetCalendarId || cfg.targetCalendarId;
  const conflictCalendarIds = shared?.conflictCalendarIds?.length
    ? shared.conflictCalendarIds
    : cfg.conflictCalendarIds;

  const startTime = new Date(data.startTime);
  const endTime = new Date(data.endTime);

  // Race condition protection: re-check availability
  const calendarIds = [
    ...(targetCalendarId ? [targetCalendarId] : []),
    ...conflictCalendarIds,
  ];
  const slotFree = await isSlotFree(cfg.coachId.toString(), calendarIds, startTime, endTime);
  if (!slotFree) throw new SlotUnavailableError();

  // Create Google Calendar event
  let googleEventId: string | undefined;
  let googleMeetLink: string | undefined;

  if (coach.googleCalendar?.connected && targetCalendarId) {
    try {
      const auth = await getAuthenticatedClient(cfg.coachId.toString());
      const calendar = google.calendar({ version: 'v3', auth });

      const event: Record<string, unknown> = {
        summary: `${cfg.name || 'Coaching Session'} — ${data.clientName}`,
        description: data.topic || 'Coaching session booked via ARTES',
        start: { dateTime: startTime.toISOString() },
        end: { dateTime: endTime.toISOString() },
        attendees: [
          { email: data.clientEmail },
          { email: coach.email },
        ],
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 1440 },
            { method: 'popup', minutes: 30 },
          ],
        },
      };

      if (cfg.googleMeetEnabled) {
        event.conferenceData = {
          createRequest: {
            requestId: `artes-booking-${Date.now()}`,
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        };
      }

      const res = await calendar.events.insert({
        calendarId: targetCalendarId,
        requestBody: event,
        conferenceDataVersion: cfg.googleMeetEnabled ? 1 : 0,
        sendUpdates: 'none',
      });

      googleEventId = res.data.id ?? undefined;
      googleMeetLink = res.data.conferenceData?.entryPoints?.find(
        (ep) => ep.entryPointType === 'video',
      )?.uri ?? undefined;
    } catch (err) {
      console.error('[Booking] Failed to create Google Calendar event:', err);
      // Continue — save booking even if calendar creation fails
    }
  }

  // Generate cancel token
  const cancelToken = jwt.sign(
    { type: 'cancel' },
    config.booking.cancelTokenSecret,
    { expiresIn: '7d' },
  );

  // Save booking
  const booking = await Booking.create({
    coachId: cfg.coachId,
    organizationId: cfg.organizationId,
    eventTypeId: cfg._id,
    eventTypeName: cfg.name || 'Coaching Session',
    clientName: data.clientName,
    clientEmail: data.clientEmail,
    clientPhone: data.clientPhone,
    topic: data.topic,
    startTime,
    endTime,
    clientTimezone: data.clientTimezone || 'UTC',
    coachTimezone: cfg.timezone,
    googleEventId,
    googleMeetLink,
    cancelToken,
    status: 'confirmed',
    remindersSent: [],
  });

  // Invalidate cache
  invalidateSlotCache(coachSlug);

  // Send confirmation emails (fire and forget)
  const coachName = `${coach.firstName} ${coach.lastName}`;
  const cancelUrl = `${config.frontendUrl}/book/${coachSlug}/cancel/${booking._id}/${cancelToken}`;

  sendBookingConfirmation(booking, coachName, coach.email, cancelUrl).catch((err) =>
    console.error('[Booking] Failed to send confirmation emails:', err),
  );

  return booking;
}

export async function cancelBooking(
  bookingId: string,
  cancelledBy: 'client' | 'coach',
  reason?: string,
): Promise<IBooking> {
  const booking = await Booking.findById(bookingId).setOptions({ bypassTenantCheck: true });
  if (!booking) throw Object.assign(new Error('Booking not found'), { statusCode: 404 });
  if (booking.status !== 'confirmed') {
    throw Object.assign(new Error('Booking is not active'), { statusCode: 400 });
  }

  // Delete/cancel Google Calendar event
  if (booking.googleEventId) {
    const coach = await User.findById(booking.coachId).select(
      '+googleCalendar.accessToken +googleCalendar.refreshToken googleCalendar.connected googleCalendar.tokenExpiry googleCalendar.calendarId',
    );
    const shared = await BookingSettings.findOne({ coachId: booking.coachId })
      .setOptions({ bypassTenantCheck: true });
    const cfg = await AvailabilityConfig.findOne({ coachId: booking.coachId })
      .setOptions({ bypassTenantCheck: true });
    const calId = shared?.targetCalendarId || cfg?.targetCalendarId;

    if (coach?.googleCalendar?.connected && calId) {
      try {
        const auth = await getAuthenticatedClient(booking.coachId.toString());
        const calendar = google.calendar({ version: 'v3', auth });
        await calendar.events.delete({
          calendarId: calId,
          eventId: booking.googleEventId,
          sendUpdates: 'none',
        });
      } catch (err) {
        console.error('[Booking] Failed to delete Google Calendar event:', err);
      }
    }
  }

  // Update booking
  booking.status = 'cancelled';
  booking.cancelledAt = new Date();
  booking.cancelledBy = cancelledBy;
  booking.cancellationReason = reason;
  await booking.save();

  // Invalidate cache
  const cfg = await AvailabilityConfig.findOne({ coachId: booking.coachId })
    .setOptions({ bypassTenantCheck: true });
  if (cfg) invalidateSlotCache(cfg.coachSlug);

  // Send cancellation email
  const coach = await User.findById(booking.coachId).select('firstName lastName email');
  if (coach) {
    const coachName = `${coach.firstName} ${coach.lastName}`;
    sendCancellationEmail(booking, coachName, coach.email, cancelledBy).catch((err) =>
      console.error('[Booking] Failed to send cancellation email:', err),
    );
  }

  return booking;
}

export async function clientCancelBooking(
  bookingId: string,
  cancelToken: string,
  reason?: string,
): Promise<IBooking> {
  // Verify the cancel token JWT
  try {
    jwt.verify(cancelToken, config.booking.cancelTokenSecret);
  } catch {
    throw Object.assign(new Error('Invalid or expired cancel link'), { statusCode: 401 });
  }

  const booking = await Booking.findById(bookingId).setOptions({ bypassTenantCheck: true });
  if (!booking || booking.cancelToken !== cancelToken) {
    throw Object.assign(new Error('Invalid cancel link'), { statusCode: 401 });
  }

  return cancelBooking(bookingId, 'client', reason);
}
