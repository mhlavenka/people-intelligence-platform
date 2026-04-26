import i18next from 'i18next';
function t(req: import('express').Request, key: string, opts?: Record<string, unknown>): string { if (typeof req.t === 'function') return String(req.t(key, opts ?? {})); return String(i18next.t(key, opts ?? {})); }
import { Response, NextFunction } from 'express';
import { calendar as calendarApi, calendar_v3 } from '@googleapis/calendar';
import { AuthRequest } from '../middleware/auth.middleware';
import { AvailabilityConfig } from '../models/AvailabilityConfig.model';
import { BookingSettings } from '../models/BookingSettings.model';
import { Booking } from '../models/Booking.model';
import { User } from '../models/User.model';
import { CoachingSession } from '../models/CoachingSession.model';
import { getAuthenticatedClient } from '../services/booking.service';
import { linkBookingToCoaching } from '../services/bookingCoachingSync.service';

interface PreviewEvent {
  googleEventId: string;
  title: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  clientName: string;
  clientEmail: string | null;
  clientPhone: null;
  topic: string | null;
  googleMeetLink: string | null;
  status: 'upcoming' | 'completed';
  alreadyImported: boolean;
  rawSummary: string;
  attendees: Array<{
    email: string;
    displayName: string | null;
    self: boolean;
    organizer: boolean;
  }>;
  /** Best guess for which Artes coachee user this event is for, matched
   *  by attendee email. null when no attendee matches a known coachee. */
  suggestedCoacheeId: string | null;
  /** Best guess for which AvailabilityConfig (event type) applies, matched
   *  by substring against the event title/description. null when no match. */
  suggestedEventTypeId: string | null;
}

interface CoacheeLite {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface EventTypeLite {
  _id: string;
  name: string;
  color: string;
  appointmentDuration: number;
}

const DEFAULT_LOOKBACK_YEARS = 2;
const DEFAULT_LOOKFORWARD_YEARS = 1;
const MIN_DURATION_MINUTES = 15;

function parseRange(q: { from?: string; to?: string }): { from: Date; to: Date } {
  const now = new Date();
  const from = q.from ? new Date(q.from) : new Date(now.getTime() - DEFAULT_LOOKBACK_YEARS * 365 * 24 * 60 * 60 * 1000);
  const to   = q.to   ? new Date(q.to)   : new Date(now.getTime() + DEFAULT_LOOKFORWARD_YEARS * 365 * 24 * 60 * 60 * 1000);
  return { from, to };
}

/** Derive a display name + email from a GCal event's attendee list. */
function pickClient(
  event: calendar_v3.Schema$Event,
  coachEmails: Set<string>,
): { clientName: string; clientEmail: string | null } {
  const attendees = (event.attendees ?? []).filter((a) => {
    if (a.self) return false;
    if (a.resource) return false;
    if (a.email && coachEmails.has(a.email.toLowerCase())) return false;
    return !!a.email;
  });
  const first = attendees[0];
  if (first?.email) {
    const displayName = (first.displayName ?? '').trim();
    if (displayName) return { clientName: displayName, clientEmail: first.email };
    // Derive a name from the email local-part when GCal didn't include one.
    const local = first.email.split('@')[0] ?? first.email;
    const guess = local.split(/[._-]/).filter(Boolean).map((p) => p[0]!.toUpperCase() + p.slice(1)).join(' ');
    return { clientName: guess || first.email, clientEmail: first.email };
  }
  return { clientName: (event.summary ?? 'Untitled').trim(), clientEmail: null };
}

function meetLinkOf(event: calendar_v3.Schema$Event): string | null {
  if (event.hangoutLink) return event.hangoutLink;
  const video = event.conferenceData?.entryPoints?.find((p) => p.entryPointType === 'video');
  return video?.uri ?? null;
}

function isImportable(event: calendar_v3.Schema$Event): boolean {
  if (event.status !== 'confirmed') return false;
  if (!event.start?.dateTime || !event.end?.dateTime) return false; // all-day skipped
  const start = new Date(event.start.dateTime).getTime();
  const end   = new Date(event.end.dateTime).getTime();
  const minutes = (end - start) / 60_000;
  if (minutes < MIN_DURATION_MINUTES) return false;
  if ((event.attendees ?? []).length <= 1) return false; // solo blocks
  return true;
}

/** Resolve the calendar the app is connected to for this coach. The
 *  canonical value lives on BookingSettings (one per coach); an event
 *  type may override it via AvailabilityConfig.targetCalendarId. Same
 *  order of precedence the booking service uses everywhere else. */
async function resolveTargetCalendarId(
  coachId: string,
  organizationId: string,
): Promise<{ calendarId: string | null; fallbackTz: string }> {
  const shared = await BookingSettings.findOne({ coachId, organizationId });
  if (shared?.targetCalendarId) {
    return { calendarId: shared.targetCalendarId, fallbackTz: shared.timezone };
  }
  const cfg = await AvailabilityConfig.findOne({ coachId, organizationId });
  return {
    calendarId: cfg?.targetCalendarId || null,
    fallbackTz: shared?.timezone ?? cfg?.timezone ?? 'UTC',
  };
}

/** Pick the first coachee whose email matches any attendee on the event. */
function matchCoachee(
  event: calendar_v3.Schema$Event,
  emailToCoacheeId: Map<string, string>,
): string | null {
  for (const a of event.attendees ?? []) {
    if (a.self || !a.email) continue;
    const hit = emailToCoacheeId.get(a.email.toLowerCase());
    if (hit) return hit;
  }
  return null;
}

/** Choose the best AvailabilityConfig whose name appears as a substring
 *  of the event title + description. Longest matching name wins. */
function matchEventType(
  event: calendar_v3.Schema$Event,
  types: EventTypeLite[],
): string | null {
  const hay = `${event.summary ?? ''} ${event.description ?? ''}`.toLowerCase();
  if (!hay.trim()) return null;
  let best: string | null = null;
  let bestLen = 0;
  for (const t of types) {
    const name = t.name.trim().toLowerCase();
    if (!name) continue;
    if (hay.includes(name) && name.length > bestLen) {
      best = t._id;
      bestLen = name.length;
    }
  }
  return best;
}

/** Paginate calendar.events.list until no nextPageToken. */
async function listAllEvents(
  calendar: calendar_v3.Calendar,
  calendarId: string,
  from: Date,
  to: Date,
): Promise<calendar_v3.Schema$Event[]> {
  const events: calendar_v3.Schema$Event[] = [];
  let pageToken: string | undefined;
  do {
    const res = await calendar.events.list({
      calendarId,
      timeMin: from.toISOString(),
      timeMax: to.toISOString(),
      singleEvents: true,
      showDeleted: false,
      orderBy: 'startTime',
      maxResults: 250,
      pageToken,
    });
    events.push(...(res.data.items ?? []));
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);
  return events;
}

// ── GET /api/booking/import/preview ────────────────────────────────────────
export async function preview(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const coachId = req.user!.userId;
    const organizationId = req.user!.organizationId;

    const overrideCalendarId = (req.query['calendarId'] as string | undefined)?.trim();
    let calendarId: string | null = overrideCalendarId || null;
    if (!calendarId) {
      ({ calendarId } = await resolveTargetCalendarId(coachId, organizationId));
    }
    if (!calendarId) {
      res.status(400).json({
        error: t(req, 'errors.noBookingCalendarSelected'),
      });
      return;
    }

    let auth;
    try {
      auth = await getAuthenticatedClient(coachId);
    } catch {
      res.status(401).json({ error: t(req, 'errors.googleCalendarNotConnected') });
      return;
    }

    const { from, to } = parseRange(req.query as { from?: string; to?: string });
    const calendar = calendarApi({ version: 'v3', auth });

    // Load matching reference data up-front so per-event matching is O(1).
    const [coacheeDocs, eventTypeDocs] = await Promise.all([
      User.find({
        organizationId,
        isActive: true,
        $or: [{ role: 'coachee' }, { isCoachee: true }],
      }).select('_id firstName lastName email'),
      AvailabilityConfig.find({ coachId, organizationId })
        .select('_id name color appointmentDuration'),
    ]);
    const coachees: CoacheeLite[] = coacheeDocs.map((c) => ({
      _id: String(c._id),
      firstName: c.firstName,
      lastName: c.lastName,
      email: c.email,
    }));
    const eventTypes: EventTypeLite[] = eventTypeDocs.map((t) => ({
      _id: String(t._id),
      name: t.name,
      color: t.color,
      appointmentDuration: t.appointmentDuration,
    }));
    const emailToCoacheeId = new Map<string, string>();
    for (const c of coachees) {
      if (c.email) emailToCoacheeId.set(c.email.toLowerCase(), c._id);
    }

    const rawEvents = await listAllEvents(calendar, calendarId, from, to);
    const coachEmails = new Set<string>();
    for (const e of rawEvents) {
      for (const a of e.attendees ?? []) {
        if (a.self && a.email) coachEmails.add(a.email.toLowerCase());
        if (a.organizer && a.email) coachEmails.add(a.email.toLowerCase());
      }
    }

    const kept = rawEvents.filter(isImportable);
    const eventIds = kept.map((e) => e.id).filter((v): v is string => !!v);

    const existing = await Booking.find({
      coachId,
      organizationId,
      googleEventId: { $in: eventIds },
    }).select('googleEventId');
    const importedSet = new Set(existing.map((b) => b.googleEventId).filter((v): v is string => !!v));

    const now = Date.now();
    const out: PreviewEvent[] = kept.map((e) => {
      const id = e.id!;
      const start = e.start!.dateTime!;
      const end   = e.end!.dateTime!;
      const durationMinutes = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60_000);
      const { clientName, clientEmail } = pickClient(e, coachEmails);
      return {
        googleEventId: id,
        title: (e.summary ?? '').trim(),
        rawSummary: (e.summary ?? '').trim(),
        startTime: start,
        endTime: end,
        durationMinutes,
        clientName,
        clientEmail,
        clientPhone: null,
        topic: (e.description ?? null),
        googleMeetLink: meetLinkOf(e),
        status: new Date(end).getTime() < now ? 'completed' : 'upcoming',
        alreadyImported: importedSet.has(id),
        attendees: (e.attendees ?? []).map((a) => ({
          email: a.email ?? '',
          displayName: a.displayName ?? null,
          self: !!a.self,
          organizer: !!a.organizer,
        })),
        suggestedCoacheeId:   matchCoachee(e, emailToCoacheeId),
        suggestedEventTypeId: matchEventType(e, eventTypes),
      };
    });

    res.json({
      total: rawEvents.length,
      filtered: out.length,
      alreadyImported: out.filter((e) => e.alreadyImported).length,
      events: out,
      coachees,
      eventTypes,
    });
  } catch (e) { next(e); }
}

// ── POST /api/booking/import/execute ───────────────────────────────────────
interface ExecuteBody {
  approvedEventIds: string[];
  /** Optional override for the source calendar; falls back to the coach's
   *  configured booking calendar when omitted. */
  calendarId?: string;
  /** Optional client-edited overrides keyed by googleEventId. A null value
   *  explicitly unsets (e.g. user cleared the auto-suggestion). undefined
   *  means "use whatever the preview suggested". */
  overrides?: Record<string, {
    clientName?: string;
    topic?: string | null;
    coacheeId?: string | null;
    eventTypeId?: string | null;
  }>;
  /** The preview's per-event suggestions, echoed back so execute doesn't
   *  have to re-run the match. Keyed by googleEventId. */
  suggestions?: Record<string, {
    suggestedCoacheeId?: string | null;
    suggestedEventTypeId?: string | null;
  }>;
}

export async function execute(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const coachId = req.user!.userId;
    const organizationId = req.user!.organizationId;
    const { approvedEventIds, overrides, suggestions, calendarId: bodyCalendarId } = req.body as ExecuteBody;

    if (!Array.isArray(approvedEventIds) || approvedEventIds.length === 0) {
      res.status(400).json({ error: t(req, 'errors.approvedEventIdsRequired') });
      return;
    }

    const resolved = await resolveTargetCalendarId(coachId, organizationId);
    const calendarId = bodyCalendarId?.trim() || resolved.calendarId;
    const fallbackTz = resolved.fallbackTz;
    if (!calendarId) {
      res.status(400).json({
        error: t(req, 'errors.noBookingCalendarSelected'),
      });
      return;
    }

    let auth;
    try {
      auth = await getAuthenticatedClient(coachId);
    } catch {
      res.status(401).json({ error: t(req, 'errors.googleCalendarNotConnected') });
      return;
    }
    const calendar = calendarApi({ version: 'v3', auth });

    // Build coach-email set from the coach's own Google profile if possible.
    const coachEmails = new Set<string>();

    let imported = 0;
    let skipped = 0;
    const errors: Array<{ googleEventId: string; message: string }> = [];

    for (const id of approvedEventIds) {
      try {
        // Idempotent: skip if already imported.
        const existing = await Booking.findOne({ coachId, organizationId, googleEventId: id });
        if (existing) { skipped++; continue; }

        const { data: event } = await calendar.events.get({ calendarId, eventId: id });
        if (!event) { errors.push({ googleEventId: id, message: 'Event not found in calendar' }); continue; }
        if (!event.start?.dateTime || !event.end?.dateTime) {
          errors.push({ googleEventId: id, message: 'All-day or invalid event' }); continue;
        }

        for (const a of event.attendees ?? []) {
          if (a.self && a.email) coachEmails.add(a.email.toLowerCase());
        }

        const { clientName, clientEmail } = pickClient(event, coachEmails);
        const override = overrides?.[id];
        const suggestion = suggestions?.[id];

        // Resolve final coachee: explicit null overrides the suggestion,
        // explicit id wins, otherwise use the preview's suggestion.
        const resolvedCoacheeId =
          override?.coacheeId === null ? null
          : (override?.coacheeId ?? suggestion?.suggestedCoacheeId ?? null);

        // Same precedence for event type.
        const resolvedEventTypeId =
          override?.eventTypeId === null ? null
          : (override?.eventTypeId ?? suggestion?.suggestedEventTypeId ?? null);

        // If a coachee was linked, prefer their name/email over whatever
        // was pulled from the calendar attendee list.
        let finalName = override?.clientName?.trim() || clientName;
        let finalEmail: string | null = clientEmail;
        let eventTypeName: string | undefined;
        if (resolvedCoacheeId) {
          const coachee = await User.findById(resolvedCoacheeId)
            .select('firstName lastName email organizationId role isCoachee');
          if (coachee && (coachee.role === 'coachee' || coachee.isCoachee === true)
              && String(coachee.organizationId) === String(organizationId)) {
            finalName = `${coachee.firstName} ${coachee.lastName}`.trim() || finalName;
            finalEmail = coachee.email ?? finalEmail;
          }
        }
        if (resolvedEventTypeId) {
          const et = await AvailabilityConfig.findById(resolvedEventTypeId).select('name coachId');
          if (et && String(et.coachId) === String(coachId)) eventTypeName = et.name;
          else { /* ignore foreign event type id */ }
        }

        const finalTopic = override?.topic !== undefined ? override.topic : (event.description ?? null);
        const startTime = new Date(event.start.dateTime);
        const endTime   = new Date(event.end.dateTime);
        const completed = endTime.getTime() < Date.now();

        const booking = await Booking.create({
          coachId,
          organizationId,
          eventTypeId: resolvedEventTypeId ?? undefined,
          eventTypeName,
          clientName: finalName,
          clientEmail: finalEmail ?? '',
          clientPhone: undefined,
          topic: finalTopic ?? undefined,
          startTime,
          endTime,
          clientTimezone: event.start.timeZone ?? fallbackTz,
          coachTimezone: fallbackTz,
          googleEventId: event.id,
          googleMeetLink: meetLinkOf(event) ?? undefined,
          cancelToken: undefined,
          status: completed ? 'completed' : 'confirmed',
          remindersSent: [],
          importedAt: new Date(),
          importSource: 'gcal_import_ui',
        });

        // If a coachee was linked, mirror into the coaching model: find or
        // create an active engagement and create a paired session. Exactly
        // the same helper the public booking flow uses.
        if (resolvedCoacheeId) {
          try {
            await linkBookingToCoaching(booking, resolvedCoacheeId);
            // linkBookingToCoaching hardcodes session.status='scheduled',
            // but for past events we want 'completed' so the session doesn't
            // linger in the coach's upcoming list.
            if (completed && booking.sessionId) {
              await CoachingSession.findByIdAndUpdate(booking.sessionId, { status: 'completed' });
            }
          } catch (linkErr) {
            // Don't fail the whole import if linking misfires — the booking
            // is already saved, the coach can re-link manually.
            const msg = linkErr instanceof Error ? linkErr.message : String(linkErr);
            console.warn(`[import] linkBookingToCoaching failed for ${id}: ${msg}`);
          }
        }

        imported++;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push({ googleEventId: id, message });
      }
    }

    res.json({ imported, skipped, errors });
  } catch (e) { next(e); }
}
