import jwt from 'jsonwebtoken';
import { DateTime } from 'luxon';
import { config } from '../config/env';
import { AvailabilityConfig } from '../models/AvailabilityConfig.model';
import { BookingSettings } from '../models/BookingSettings.model';
import { Booking, IBooking } from '../models/Booking.model';
import { User } from '../models/User.model';
import { invalidateSlotCache } from './availability.service';
import {
  sendBookingConfirmation,
  sendCancellationEmail,
  sendRescheduleConfirmation,
} from './bookingNotification.service';
import {
  notifyBookingConfirmed,
  notifyBookingCancelled,
  notifyBookingRescheduled,
} from './hubNotification.service';
import {
  propagateBookingCancel,
  propagateBookingReschedule,
} from './bookingCoachingSync.service';
import { CoachingSession } from '../models/CoachingSession.model';
import { getCoachCalendarProvider, getGoogleAuthenticatedClient } from './calendar';

const DEFAULT_RESCHEDULE_DEADLINE_HOURS = 24;

async function getDeadlineHours(coachId: string): Promise<number> {
  const settings = await BookingSettings.findOne({ coachId })
    .select('rescheduleDeadlineHours')
    .setOptions({ bypassTenantCheck: true });
  return settings?.rescheduleDeadlineHours ?? DEFAULT_RESCHEDULE_DEADLINE_HOURS;
}

function isWithinDeadline(startTime: Date, deadlineHours: number): boolean {
  const hoursUntil = (startTime.getTime() - Date.now()) / (60 * 60 * 1000);
  return hoursUntil < deadlineHours;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

// Re-exported for booking-import.controller.ts backward compat
export { getGoogleAuthenticatedClient as getAuthenticatedClient } from './calendar';

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
  const existingBooking = await Booking.findOne({
    coachId,
    status: 'confirmed',
    startTime: { $lt: end },
    endTime: { $gt: start },
  }).setOptions({ bypassTenantCheck: true });

  if (existingBooking) return false;

  if (calendarIds.length) {
    try {
      const cp = await getCoachCalendarProvider(coachId);
      if (cp) {
        const busy = await cp.provider.queryFreebusy(
          coachId, calendarIds, start.toISOString(), end.toISOString(),
        );
        if (busy.length > 0) return false;
      }
    } catch (err) {
      console.error('[Booking] Failed to check calendar freebusy:', err);
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

  const coach = await User.findById(cfg.coachId).select('firstName lastName email');
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

  const calendarIds = Array.from(
    new Set(
      [targetCalendarId, ...(conflictCalendarIds || [])].filter(Boolean) as string[],
    ),
  );
  const slotFree = await isSlotFree(cfg.coachId.toString(), calendarIds, startTime, endTime);
  if (!slotFree) throw new SlotUnavailableError();

  // Create calendar event via provider
  let googleEventId: string | undefined;
  let googleMeetLink: string | undefined;

  const cp = await getCoachCalendarProvider(cfg.coachId.toString());
  if (cp && targetCalendarId) {
    try {
      const result = await cp.provider.createEvent(cfg.coachId.toString(), targetCalendarId, {
        summary: `${cfg.name || 'Coaching Session'} — ${data.clientName}`,
        description: data.topic || 'Coaching session booked via ARTES',
        startTime,
        endTime,
        attendeeEmail: data.clientEmail,
        enableVideoConference: cfg.googleMeetEnabled,
      });
      googleEventId = result.eventId;
      googleMeetLink = result.meetLink;
    } catch (err) {
      console.error('[Booking] Failed to create calendar event:', err);
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

  notifyBookingConfirmed({
    coachId: booking.coachId,
    coacheeId: booking.coacheeId,
    engagementId: booking.engagementId,
    organizationId: booking.organizationId,
    clientName: booking.clientName,
    coachName,
    startTime: booking.startTime,
  }).catch((err) => console.error('[Booking] Hub notification failed:', err));

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

  if (!booking.googleEventId) {
    console.warn(`[Booking] Booking ${booking._id} has no calendarEventId — skipping delete`);
  } else {
    const shared = await BookingSettings.findOne({ coachId: booking.coachId })
      .setOptions({ bypassTenantCheck: true });
    const cfgDel = await AvailabilityConfig.findOne({ coachId: booking.coachId })
      .setOptions({ bypassTenantCheck: true });
    const calId = shared?.targetCalendarId || cfgDel?.targetCalendarId;
    const cp = await getCoachCalendarProvider(booking.coachId.toString());

    if (cp && calId) {
      try {
        await cp.provider.deleteEvent(booking.coachId.toString(), calId, booking.googleEventId);
      } catch (err) {
        const code = (err as { code?: number })?.code;
        if (code === 404 || code === 410) {
          console.info(
            `[Booking] Calendar event ${booking.googleEventId} already gone (${code}) — skipping`,
          );
        } else {
          console.error(`[Booking] Failed to delete calendar event ${booking.googleEventId}:`, err);
        }
      }
    }
  }

  // Update booking
  booking.status = 'cancelled';
  booking.cancelledAt = new Date();
  booking.cancelledBy = cancelledBy;
  booking.cancellationReason = reason;
  await booking.save();

  // Mirror cancel into the linked CoachingSession (if any).
  // Late cancellations (by client, within the reschedule deadline) still
  // count against the coachee's session allotment.
  const isLate = cancelledBy === 'client'
    && isWithinDeadline(booking.startTime, await getDeadlineHours(booking.coachId.toString()));

  if (booking.sessionId) {
    const update: Record<string, unknown> = { status: 'cancelled' };
    if (isLate) update['lateCancellation'] = true;
    await CoachingSession.findByIdAndUpdate(booking.sessionId, update)
      .setOptions({ bypassTenantCheck: true })
      .catch((err) => console.error('[BookingSync] Failed to propagate cancel:', err));
  } else {
    await propagateBookingCancel(booking).catch((err) =>
      console.error('[BookingSync] Failed to propagate cancel:', err),
    );
  }

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

    notifyBookingCancelled({
      coachId: booking.coachId,
      coacheeId: booking.coacheeId,
      engagementId: booking.engagementId,
      organizationId: booking.organizationId,
      clientName: booking.clientName,
      coachName,
      cancelledBy,
      startTime: booking.startTime,
    }).catch((err) => console.error('[Booking] Hub notification failed:', err));
  }

  return booking;
}

/**
 * Reschedule a confirmed booking.
 *
 *   triggeredBy = 'coach_gcal' — change originated from the coach moving the
 *     event in Google Calendar. The GCal event already has the new time, so
 *     we skip updating GCal and skip emailing the coach. Only the client
 *     gets notified.
 *   triggeredBy = 'admin' — change originated from the admin/coach UI; we
 *     update the GCal event and email both parties.
 */
export async function rescheduleBooking(
  bookingId: string,
  newStartTime: Date,
  newEndTime: Date,
  triggeredBy: 'coach_gcal' | 'admin' | 'coachee',
  note?: string,
): Promise<IBooking> {
  const booking = await Booking.findById(bookingId).setOptions({ bypassTenantCheck: true });
  if (!booking) throw Object.assign(new Error('Booking not found'), { statusCode: 404 });
  if (booking.status !== 'confirmed') {
    throw Object.assign(new Error('Booking is not active'), { statusCode: 400 });
  }
  if (newStartTime.getTime() <= Date.now()) {
    throw Object.assign(new Error('New start time must be in the future'), { statusCode: 400 });
  }
  if (newEndTime.getTime() <= newStartTime.getTime()) {
    throw Object.assign(new Error('End time must be after start time'), { statusCode: 400 });
  }

  if (triggeredBy === 'coachee') {
    const deadlineHours = await getDeadlineHours(booking.coachId.toString());
    if (isWithinDeadline(booking.startTime, deadlineHours)) {
      throw Object.assign(
        new Error(`Rescheduling is no longer available — the ${deadlineHours}-hour deadline has passed. You may cancel, but the session will count toward your allotment.`),
        { statusCode: 403 },
      );
    }
  }

  const oldStartTime = booking.startTime;

  if (triggeredBy !== 'coach_gcal' && booking.googleEventId) {
    const shared = await BookingSettings.findOne({ coachId: booking.coachId })
      .setOptions({ bypassTenantCheck: true });
    const cfgResc = await AvailabilityConfig.findOne({ coachId: booking.coachId })
      .setOptions({ bypassTenantCheck: true });
    const calId = shared?.targetCalendarId || cfgResc?.targetCalendarId;
    const cp = await getCoachCalendarProvider(booking.coachId.toString());

    if (cp && calId) {
      try {
        await cp.provider.updateEvent(booking.coachId.toString(), calId, booking.googleEventId, {
          startTime: newStartTime,
          endTime: newEndTime,
        });
      } catch (err) {
        const code = (err as { code?: number })?.code;
        if (code === 404 || code === 410) {
          console.warn(
            `[Booking] Calendar event ${booking.googleEventId} gone during reschedule — continuing`,
          );
        } else {
          console.error(`[Booking] Failed to update calendar event ${booking.googleEventId}:`, err);
        }
      }
    }
  }

  // Rotate cancel token (7-day expiry anchored to the new booking time).
  const newCancelToken = jwt.sign(
    { type: 'cancel' },
    config.booking.cancelTokenSecret,
    { expiresIn: '7d' },
  );

  booking.startTime = newStartTime;
  booking.endTime = newEndTime;
  booking.rescheduledAt = new Date();
  booking.rescheduledBy = triggeredBy;
  booking.rescheduleHistory.push({
    from: oldStartTime,
    to: newStartTime,
    by: triggeredBy,
    at: new Date(),
  });
  booking.cancelToken = newCancelToken;
  booking.remindersSent = []; // re-eligible for reminders at the new time
  await booking.save();

  // Mirror reschedule into the linked CoachingSession (if any)
  await propagateBookingReschedule(booking, newStartTime, newEndTime).catch((err) =>
    console.error('[BookingSync] Failed to propagate reschedule:', err),
  );

  // Invalidate availability cache
  const cfg = await AvailabilityConfig.findOne({ coachId: booking.coachId })
    .setOptions({ bypassTenantCheck: true });
  if (cfg) invalidateSlotCache(cfg.coachSlug);

  // Notify
  const coach = await User.findById(booking.coachId).select('firstName lastName email');
  if (coach && cfg) {
    const coachName = `${coach.firstName} ${coach.lastName}`;
    const cancelUrl =
      `${config.frontendUrl}/book/${cfg.coachSlug}/cancel/${booking._id}/${newCancelToken}`;
    sendRescheduleConfirmation(
      booking, coachName, coach.email, oldStartTime, cancelUrl, triggeredBy, note,
    ).catch((err) => console.error('[Booking] Failed to send reschedule email:', err));

    notifyBookingRescheduled({
      coachId: booking.coachId,
      coacheeId: booking.coacheeId,
      engagementId: booking.engagementId,
      organizationId: booking.organizationId,
      clientName: booking.clientName,
      coachName,
      oldTime: oldStartTime,
      newTime: newStartTime,
      triggeredBy,
    }).catch((err) => console.error('[Booking] Hub notification failed:', err));
  }

  console.info(`[Booking] Booking ${booking._id} rescheduled by ${triggeredBy}`);
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
