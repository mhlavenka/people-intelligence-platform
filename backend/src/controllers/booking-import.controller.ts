import { Response, NextFunction } from 'express';
import { google, calendar_v3 } from 'googleapis';
import { AuthRequest } from '../middleware/auth.middleware';
import { AvailabilityConfig } from '../models/AvailabilityConfig.model';
import { Booking } from '../models/Booking.model';
import { getAuthenticatedClient } from '../services/booking.service';

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

    // Pick the coach's primary AvailabilityConfig — any one will do for
    // targetCalendarId (all event types share the same Google calendar).
    const cfg = await AvailabilityConfig.findOne({ coachId, organizationId });
    if (!cfg) {
      res.status(400).json({ error: 'No booking configuration found. Create an event type first.' });
      return;
    }
    const calendarId = cfg.targetCalendarId || 'primary';

    let auth;
    try {
      auth = await getAuthenticatedClient(coachId);
    } catch {
      res.status(401).json({ error: 'Google Calendar not connected. Connect it from Booking → Settings first.' });
      return;
    }

    const { from, to } = parseRange(req.query as { from?: string; to?: string });
    const calendar = google.calendar({ version: 'v3', auth });

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
      };
    });

    res.json({
      total: rawEvents.length,
      filtered: out.length,
      alreadyImported: out.filter((e) => e.alreadyImported).length,
      events: out,
    });
  } catch (e) { next(e); }
}

// ── POST /api/booking/import/execute ───────────────────────────────────────
interface ExecuteBody {
  approvedEventIds: string[];
  /** Optional client-edited overrides keyed by googleEventId. */
  overrides?: Record<string, { clientName?: string; topic?: string | null }>;
}

export async function execute(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const coachId = req.user!.userId;
    const organizationId = req.user!.organizationId;
    const { approvedEventIds, overrides } = req.body as ExecuteBody;

    if (!Array.isArray(approvedEventIds) || approvedEventIds.length === 0) {
      res.status(400).json({ error: 'approvedEventIds must be a non-empty array.' });
      return;
    }

    const cfg = await AvailabilityConfig.findOne({ coachId, organizationId });
    if (!cfg) {
      res.status(400).json({ error: 'No booking configuration found.' });
      return;
    }
    const calendarId = cfg.targetCalendarId || 'primary';

    let auth;
    try {
      auth = await getAuthenticatedClient(coachId);
    } catch {
      res.status(401).json({ error: 'Google Calendar not connected.' });
      return;
    }
    const calendar = google.calendar({ version: 'v3', auth });

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
        const finalName = override?.clientName?.trim() || clientName;
        const finalTopic = override?.topic !== undefined ? override.topic : (event.description ?? null);
        const startTime = new Date(event.start.dateTime);
        const endTime   = new Date(event.end.dateTime);
        const completed = endTime.getTime() < Date.now();

        await Booking.create({
          coachId,
          organizationId,
          clientName: finalName,
          clientEmail: clientEmail ?? '',
          clientPhone: undefined,
          topic: finalTopic ?? undefined,
          startTime,
          endTime,
          clientTimezone: event.start.timeZone ?? cfg.timezone,
          coachTimezone: cfg.timezone,
          googleEventId: event.id,
          googleMeetLink: meetLinkOf(event) ?? undefined,
          cancelToken: undefined,
          status: completed ? 'completed' : 'confirmed',
          remindersSent: [],
          importedAt: new Date(),
          importSource: 'gcal_import_ui',
        });
        imported++;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push({ googleEventId: id, message });
      }
    }

    res.json({ imported, skipped, errors });
  } catch (e) { next(e); }
}
