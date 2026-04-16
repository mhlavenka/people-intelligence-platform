import crypto from 'crypto';
import { calendar as calendarApi } from '@googleapis/calendar';
import { OAuth2Client } from 'google-auth-library';
import { config } from '../config/env';
import { User } from '../models/User.model';
import { BookingSettings } from '../models/BookingSettings.model';
import { AvailabilityConfig } from '../models/AvailabilityConfig.model';
import { Booking } from '../models/Booking.model';
import { WebhookState } from '../models/WebhookState.model';
import { cancelBooking, rescheduleBooking } from './booking.service';
import { invalidateSlotCache } from './availability.service';

// ─── OAuth client helper ────────────────────────────────────────────────────
// Kept local to avoid a circular import back into booking.service.

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

// ─── Target calendar resolution ─────────────────────────────────────────────

async function resolveTargetCalendarId(coachId: string): Promise<string | null> {
  const shared = await BookingSettings.findOne({ coachId })
    .setOptions({ bypassTenantCheck: true });
  if (shared?.targetCalendarId) return shared.targetCalendarId;
  const cfg = await AvailabilityConfig.findOne({ coachId })
    .setOptions({ bypassTenantCheck: true });
  return cfg?.targetCalendarId || null;
}

// ─── Channel lifecycle ──────────────────────────────────────────────────────

function webhookAddress(): string {
  const base = config.booking.publicApiBaseUrl || config.booking.apiBaseUrl;
  return `${base.replace(/\/$/, '')}/api/webhooks/gcal`;
}

/**
 * Register (or re-register) a push-notification channel for the coach's
 * target calendar. Idempotent: if a previous channel exists for the same
 * coach×calendar pair, it's stopped before the new one is created.
 *
 * No-op when `config.booking.webhooksEnabled` is false. The flag stays off
 * until the public HTTPS path is reachable by Google.
 */
export async function registerGoogleWebhook(coachId: string): Promise<void> {
  if (!config.booking.webhooksEnabled) {
    console.info(`[Webhook] Skipped registration for ${coachId} — feature flag OFF`);
    return;
  }

  const calendarId = await resolveTargetCalendarId(coachId);
  if (!calendarId) {
    console.info(`[Webhook] No target calendar for ${coachId} — skipping`);
    return;
  }

  // Stop the previous channel for this coach×calendar before creating a new one
  await stopGoogleWebhook(coachId, { silent: true });

  const auth = await getAuthenticatedClient(coachId);
  const calendar = calendarApi({ version: 'v3', auth });

  const channelId = `artes-${coachId}-${crypto.randomBytes(8).toString('hex')}`;
  const token = config.booking.webhookSecret || undefined;
  // Google caps at 30 days; we request max and renew proactively via cron.
  const expirationMs = Date.now() + 30 * 24 * 60 * 60 * 1000;

  try {
    const res = await calendar.events.watch({
      calendarId,
      requestBody: {
        id: channelId,
        type: 'web_hook',
        address: webhookAddress(),
        token,
        expiration: String(expirationMs),
      },
    });

    const resourceId = res.data.resourceId;
    const expiration = res.data.expiration
      ? new Date(Number(res.data.expiration))
      : new Date(expirationMs);

    if (!resourceId) {
      console.error(`[Webhook] Google did not return resourceId for ${coachId}`);
      return;
    }

    await WebhookState.findOneAndUpdate(
      { coachId, calendarId },
      {
        coachId, calendarId, channelId, resourceId,
        expiration, lastProcessedAt: new Date(),
      },
      { upsert: true, new: true },
    );

    console.info(
      `[Webhook] Registered channel ${channelId} for coach ${coachId} (expires ${expiration.toISOString()})`,
    );
  } catch (err) {
    console.error(`[Webhook] Failed to register channel for ${coachId}:`, err);
  }
}

/**
 * Stop the currently-registered channel (if any) for the coach. Safe to
 * call when there is no registration or the channel has already expired.
 */
export async function stopGoogleWebhook(
  coachId: string,
  opts: { silent?: boolean } = {},
): Promise<void> {
  const state = await WebhookState.findOne({ coachId });
  if (!state) return;

  if (config.booking.webhooksEnabled) {
    try {
      const auth = await getAuthenticatedClient(coachId);
      const calendar = calendarApi({ version: 'v3', auth });
      await calendar.channels.stop({
        requestBody: { id: state.channelId, resourceId: state.resourceId },
      });
    } catch (err) {
      const code = (err as { code?: number })?.code;
      if (code === 404 || code === 410) {
        if (!opts.silent) console.info(`[Webhook] Channel ${state.channelId} already gone`);
      } else if (!opts.silent) {
        console.error(`[Webhook] Failed to stop channel ${state.channelId}:`, err);
      }
    }
  }

  await WebhookState.deleteOne({ _id: state._id });
  if (!opts.silent) {
    console.info(`[Webhook] Stopped channel for coach ${coachId}`);
  }
}

/**
 * Renew every channel whose expiration is within 2 days. Runs from the
 * renewal cron. Idempotent: `registerGoogleWebhook` stops the old channel
 * and opens a new one.
 */
export async function renewExpiringWebhooks(): Promise<void> {
  if (!config.booking.webhooksEnabled) return;

  const soon = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
  const expiring = await WebhookState.find({ expiration: { $lte: soon } });
  for (const s of expiring) {
    try {
      await registerGoogleWebhook(s.coachId.toString());
    } catch (err) {
      console.error(`[Webhook] Renewal failed for ${s.coachId}:`, err);
    }
  }
}

// ─── Notification handling ──────────────────────────────────────────────────

/**
 * Process a Google push notification. Called from the webhook HTTP route.
 *
 *   Step 1  Validate headers (X-Goog-Channel-ID / X-Goog-Resource-ID) match
 *           a stored WebhookState and the optional token matches our secret.
 *   Step 2  If resourceState === 'sync', this is the initial handshake — ack.
 *   Step 3  For other states, call events.list(updatedMin=lastProcessedAt,
 *           showDeleted=true) to discover the actual change set. Google's
 *           payload itself does NOT carry the changed event id.
 *   Step 4  For each returned event, match by googleEventId against a Booking.
 *           Dispatch cancel or reschedule as appropriate. Never touch events
 *           that don't correspond to one of our bookings.
 *   Step 5  Advance lastProcessedAt and flush the slot cache.
 */
export async function handleGoogleNotification(headers: {
  channelId?: string;
  resourceId?: string;
  resourceState?: string;
  channelToken?: string;
}): Promise<void> {
  const { channelId, resourceId, resourceState, channelToken } = headers;
  if (!channelId || !resourceId) {
    console.warn('[Webhook] Missing channelId/resourceId headers — ignoring');
    return;
  }

  const state = await WebhookState.findOne({ channelId });
  if (!state) {
    console.warn(`[Webhook] Unknown channel ${channelId} — ignoring`);
    return;
  }
  if (state.resourceId !== resourceId) {
    console.warn(`[Webhook] resourceId mismatch for ${channelId} — ignoring`);
    return;
  }
  if (config.booking.webhookSecret && channelToken !== config.booking.webhookSecret) {
    console.warn(`[Webhook] Token mismatch for ${channelId} — ignoring`);
    return;
  }

  if (resourceState === 'sync') {
    // Initial handshake from Google. Nothing to do.
    return;
  }

  const coachId = state.coachId.toString();
  const updatedMin = state.lastProcessedAt.toISOString();
  const processedAt = new Date();

  let changed: Array<{
    id?: string | null;
    status?: string | null;
    start?: { dateTime?: string | null } | null;
    end?: { dateTime?: string | null } | null;
  }> = [];

  try {
    const auth = await getAuthenticatedClient(coachId);
    const calendar = calendarApi({ version: 'v3', auth });
    const res = await calendar.events.list({
      calendarId: state.calendarId,
      updatedMin,
      showDeleted: true,
      singleEvents: true,
      maxResults: 50,
    });
    changed = res.data.items ?? [];
  } catch (err) {
    console.error(`[Webhook] events.list failed for ${coachId}:`, err);
    // Still advance lastProcessedAt so a single failure doesn't trap the stream.
    state.lastProcessedAt = processedAt;
    await state.save();
    return;
  }

  console.info(`[Webhook] Processing ${changed.length} changed event(s) for coach ${coachId} (since ${updatedMin})`);

  for (const evt of changed) {
    if (!evt.id) continue;

    const booking = await Booking.findOne({ googleEventId: evt.id })
      .setOptions({ bypassTenantCheck: true });
    if (!booking) {
      console.info(`[Webhook] Event ${evt.id} (status=${evt.status}) — no matching booking, skipping`);
      continue;
    }

    try {
      if (evt.status === 'cancelled') {
        if (booking.status === 'confirmed') {
          await cancelBooking(booking._id.toString(), 'coach', 'Cancelled via Google Calendar');
          console.info(`[Webhook] Booking ${booking._id} auto-cancelled via GCal`);
        }
        continue;
      }

      const newStartIso = evt.start?.dateTime;
      const newEndIso = evt.end?.dateTime;
      if (!newStartIso || !newEndIso) continue;

      const newStart = new Date(newStartIso);
      const newEnd = new Date(newEndIso);

      const startMoved = newStart.getTime() !== booking.startTime.getTime();
      const endMoved = newEnd.getTime() !== booking.endTime.getTime();
      if (startMoved || endMoved) {
        if (booking.status !== 'confirmed') continue;
        if (newStart.getTime() <= Date.now()) {
          console.info(`[Webhook] Skipping past reschedule for booking ${booking._id}`);
          continue;
        }
        await rescheduleBooking(booking._id.toString(), newStart, newEnd, 'coach_gcal');
        console.info(`[Webhook] Booking ${booking._id} rescheduled via GCal`);
      }
    } catch (err) {
      console.error(`[Webhook] Failed to process event ${evt.id} for booking ${booking._id}:`, err);
    }
  }

  state.lastProcessedAt = processedAt;
  await state.save();

  const cfg = await AvailabilityConfig.findOne({ coachId: state.coachId })
    .setOptions({ bypassTenantCheck: true });
  if (cfg) invalidateSlotCache(cfg.coachSlug);
}
