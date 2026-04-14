import { DateTime, Interval } from 'luxon';
import NodeCache from 'node-cache';
import { calendar as calendarApi } from '@googleapis/calendar';
import { OAuth2Client } from 'google-auth-library';
import { AvailabilityConfig, IAvailabilityConfig } from '../models/AvailabilityConfig.model';
import { BookingSettings, IBookingSettings } from '../models/BookingSettings.model';
import { Booking } from '../models/Booking.model';
import { User } from '../models/User.model';
import { config } from '../config/env';

// ─── Cache ──────────────────────────────────────────────────────────────────

const slotCache = new NodeCache({ stdTTL: 120, checkperiod: 30 });

export function invalidateSlotCache(coachSlug: string): void {
  const keys = slotCache.keys().filter((k) => k.startsWith(`slots:${coachSlug}:`));
  keys.forEach((k) => slotCache.del(k));
}

export function invalidateAllCacheForCoach(coachSlug: string): void {
  invalidateSlotCache(coachSlug);
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AvailableSlot {
  startUtc: string;
  endUtc: string;
  startLocal: string;
  endLocal: string;
  label: string;
}

interface BusyPeriod {
  start: DateTime;
  end: DateTime;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function createOAuth2Client() {
  return new OAuth2Client(
    config.oauth.google.clientId,
    config.oauth.google.clientSecret,
    config.oauth.google.calendarRedirectUri,
  );
}

async function getAuthenticatedClient(coachId: string) {
  const coach = await User.findById(coachId).select(
    '+googleCalendar.accessToken +googleCalendar.refreshToken googleCalendar.connected googleCalendar.tokenExpiry',
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

async function fetchGoogleBusyPeriods(
  coachId: string,
  calendarIds: string[],
  timeMin: string,
  timeMax: string,
): Promise<BusyPeriod[]> {
  if (!calendarIds.length) return [];

  // Google's freebusy API returns only BUSY periods by default — events marked
  // as FREE (e.g. all-day placeholder events, availability blocks from other
  // tools) are intentionally excluded. This matches Calendly's behavior: only
  // BUSY events block availability. Do NOT add `timeZone` or any other option
  // here that could alter this contract.
  // Ref: calendar.freebusy.query returns `busy[]` containing periods where
  // `transparency === 'opaque'`.
  const uniqueIds = Array.from(new Set(calendarIds.filter(Boolean)));

  try {
    const auth = await getAuthenticatedClient(coachId);
    const calendar = calendarApi({ version: 'v3', auth });
    const res = await calendar.freebusy.query({
      requestBody: {
        timeMin,
        timeMax,
        items: uniqueIds.map((id) => ({ id })),
      },
    });

    const busyPeriods: BusyPeriod[] = [];
    const calendars = res.data.calendars ?? {};
    for (const calId of Object.keys(calendars)) {
      const busy = calendars[calId]?.busy ?? [];
      for (const b of busy) {
        if (b.start && b.end) {
          busyPeriods.push({
            start: DateTime.fromISO(b.start, { zone: 'utc' }),
            end: DateTime.fromISO(b.end, { zone: 'utc' }),
          });
        }
      }
    }
    return busyPeriods;
  } catch (err) {
    console.error('[Availability] Failed to fetch Google busy periods:', err);
    return [];
  }
}

async function fetchBookingBusyPeriods(
  coachId: string,
  from: Date,
  to: Date,
): Promise<BusyPeriod[]> {
  const bookings = await Booking.find({
    coachId,
    status: 'confirmed',
    startTime: { $lt: to },
    endTime: { $gt: from },
  }).setOptions({ bypassTenantCheck: true });

  return bookings.map((b) => ({
    start: DateTime.fromJSDate(b.startTime, { zone: 'utc' }),
    end: DateTime.fromJSDate(b.endTime, { zone: 'utc' }),
  }));
}

function overlaps(slotStart: DateTime, slotEnd: DateTime, busyPeriods: BusyPeriod[]): boolean {
  for (const bp of busyPeriods) {
    if (slotStart < bp.end && slotEnd > bp.start) return true;
  }
  return false;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/** Load the shared BookingSettings for a coach, falling back to AvailabilityConfig fields.
 *  If the event type opts into a custom schedule (scheduleMode === 'custom' and
 *  weeklySchedule has entries), that per-event-type schedule is used instead
 *  of the shared one. Calendars + timezone stay shared. */
async function loadScheduleAndCalendars(cfg: IAvailabilityConfig) {
  const shared = await BookingSettings.findOne({ coachId: cfg.coachId })
    .setOptions({ bypassTenantCheck: true });

  const usesCustomSchedule =
    cfg.scheduleMode === 'custom' && cfg.weeklySchedule?.length > 0;

  const weeklySchedule = usesCustomSchedule
    ? cfg.weeklySchedule
    : (shared?.weeklySchedule?.length ? shared.weeklySchedule : cfg.weeklySchedule);

  return {
    timezone: shared?.timezone || cfg.timezone,
    weeklySchedule,
    dateOverrides: shared?.dateOverrides?.length ? shared.dateOverrides : cfg.dateOverrides,
    targetCalendarId: shared?.targetCalendarId || cfg.targetCalendarId,
    conflictCalendarIds: shared?.conflictCalendarIds?.length
      ? shared.conflictCalendarIds
      : cfg.conflictCalendarIds,
  };
}

export async function getAvailableSlots(
  coachSlug: string,
  fromDate: string,
  toDate: string,
  clientTimezone: string,
): Promise<AvailableSlot[]> {
  const cacheKey = `slots:${coachSlug}:${fromDate}:${toDate}:${clientTimezone}`;
  const cached = slotCache.get<AvailableSlot[]>(cacheKey);
  if (cached) return cached;

  const cfg = await AvailabilityConfig.findOne({ coachSlug, isActive: true })
    .setOptions({ bypassTenantCheck: true });
  if (!cfg) return [];

  const shared = await loadScheduleAndCalendars(cfg);

  const coachTz = shared.timezone;
  const now = DateTime.now().setZone(coachTz);
  const minNotice = now.plus({ hours: cfg.minNoticeHours });
  const maxAdvance = now.plus({ days: cfg.maxAdvanceDays });

  let rangeStart = DateTime.fromISO(fromDate, { zone: coachTz }).startOf('day');
  let rangeEnd = DateTime.fromISO(toDate, { zone: coachTz }).endOf('day');

  if (rangeStart < minNotice.startOf('day')) {
    rangeStart = minNotice.startOf('day');
  }
  if (rangeEnd > maxAdvance.endOf('day')) {
    rangeEnd = maxAdvance.endOf('day');
  }
  if (rangeStart >= rangeEnd) return [];

  const candidates: { start: DateTime; end: DateTime }[] = [];
  let cursor = rangeStart;

  while (cursor <= rangeEnd) {
    const dayOfWeek = cursor.weekday % 7;

    const dateStr = cursor.toISODate();
    const override = shared.dateOverrides.find(
      (o) => DateTime.fromJSDate(o.date, { zone: coachTz }).toISODate() === dateStr,
    );

    let dayStart: string | null = null;
    let dayEnd: string | null = null;

    if (override) {
      if (override.isUnavailable) {
        cursor = cursor.plus({ days: 1 });
        continue;
      }
      dayStart = override.startTime;
      dayEnd = override.endTime;
    } else {
      const schedule = shared.weeklySchedule.find((s) => s.dayOfWeek === dayOfWeek);
      if (!schedule || !schedule.enabled) {
        cursor = cursor.plus({ days: 1 });
        continue;
      }
      dayStart = schedule.startTime;
      dayEnd = schedule.endTime;
    }

    if (dayStart && dayEnd) {
      const [sh, sm] = dayStart.split(':').map(Number);
      const [eh, em] = dayEnd.split(':').map(Number);
      let slotStart = cursor.set({ hour: sh, minute: sm, second: 0, millisecond: 0 });
      const slotBoundary = cursor.set({ hour: eh, minute: em, second: 0, millisecond: 0 });
      const step = cfg.appointmentDuration + cfg.bufferTime;

      let bookingsThisDay = 0;

      while (slotStart.plus({ minutes: cfg.appointmentDuration }) <= slotBoundary) {
        if (cfg.maxBookingsPerDay && bookingsThisDay >= cfg.maxBookingsPerDay) break;

        const slotEnd = slotStart.plus({ minutes: cfg.appointmentDuration });

        if (slotStart >= minNotice) {
          candidates.push({ start: slotStart, end: slotEnd });
          bookingsThisDay++;
        }

        slotStart = slotStart.plus({ minutes: step });
      }
    }

    cursor = cursor.plus({ days: 1 });
  }

  if (!candidates.length) return [];

  // B8: targetCalendarId must always be checked for conflicts, even if the
  // admin saved an empty conflictCalendarIds list. Dedup because a careless
  // admin might list the target inside conflictCalendarIds too.
  const calendarIds = Array.from(
    new Set(
      [
        shared.targetCalendarId,
        ...(shared.conflictCalendarIds || []),
      ].filter(Boolean) as string[],
    ),
  );

  // B7: anchor timeMin to max(rangeStart, now + minNotice) so a stale cached
  // request (replayed with a past fromDate) can never query freebusy for past time.
  const freebusyFloor = DateTime.max(rangeStart, minNotice);
  const rangeStartUtc = freebusyFloor.toUTC().toISO()!;
  const rangeEndUtc = rangeEnd.toUTC().toISO()!;

  const [googleBusy, bookingBusy] = await Promise.all([
    fetchGoogleBusyPeriods(cfg.coachId.toString(), calendarIds, rangeStartUtc, rangeEndUtc),
    fetchBookingBusyPeriods(cfg.coachId.toString(), rangeStart.toJSDate(), rangeEnd.toJSDate()),
  ]);

  const allBusy = [...googleBusy, ...bookingBusy];

  const available: AvailableSlot[] = [];
  for (const slot of candidates) {
    const startUtc = slot.start.toUTC();
    const endUtc = slot.end.toUTC();

    if (!overlaps(startUtc, endUtc, allBusy)) {
      const startLocal = startUtc.setZone(clientTimezone);
      const endLocal = endUtc.setZone(clientTimezone);

      available.push({
        startUtc: startUtc.toISO()!,
        endUtc: endUtc.toISO()!,
        startLocal: startLocal.toISO()!,
        endLocal: endLocal.toISO()!,
        label: `${startLocal.toFormat('h:mm a')} – ${endLocal.toFormat('h:mm a')}`,
      });
    }
  }

  slotCache.set(cacheKey, available);
  return available;
}

export async function getPublicCoachInfo(coachSlug: string) {
  const cfg = await AvailabilityConfig.findOne({ coachSlug, isActive: true })
    .setOptions({ bypassTenantCheck: true });
  if (!cfg) return null;

  const shared = await loadScheduleAndCalendars(cfg);
  const coach = await User.findById(cfg.coachId).select('firstName lastName email');
  if (!coach) return null;

  return {
    coachName: `${coach.firstName} ${coach.lastName}`,
    coachEmail: coach.email,
    title: cfg.bookingPageTitle || `Book a session with ${coach.firstName}`,
    description: cfg.bookingPageDesc || '',
    duration: cfg.appointmentDuration,
    timezone: shared.timezone,
  };
}
