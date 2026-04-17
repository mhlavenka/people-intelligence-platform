import { Client } from '@microsoft/microsoft-graph-client';
import { ConfidentialClientApplication } from '@azure/msal-node';
import { config } from '../config/env';
import { User } from '../models/User.model';
import { Booking } from '../models/Booking.model';
import { BookingSettings } from '../models/BookingSettings.model';
import { AvailabilityConfig } from '../models/AvailabilityConfig.model';
import { WebhookState } from '../models/WebhookState.model';
import { cancelBooking, rescheduleBooking } from './booking.service';
import { invalidateSlotCache } from './availability.service';

const SCOPES = ['Calendars.ReadWrite', 'Calendars.Read', 'User.Read', 'offline_access'];

// ─── Auth helpers ──────────────────────────────────────────────────────────

function getMsalClient(): ConfidentialClientApplication {
  return new ConfidentialClientApplication({
    auth: {
      clientId: config.oauth.microsoft.clientId,
      authority: `https://login.microsoftonline.com/${config.oauth.microsoft.tenantId}`,
      clientSecret: config.oauth.microsoft.clientSecret,
    },
  });
}

async function getGraphClient(coachId: string): Promise<Client> {
  const coach = await User.findById(coachId).select(
    '+microsoftCalendar.accessToken +microsoftCalendar.refreshToken microsoftCalendar.connected microsoftCalendar.tokenExpiry',
  );
  if (!coach?.microsoftCalendar?.connected || !coach.microsoftCalendar.refreshToken) {
    throw new Error('Microsoft Calendar not connected');
  }

  let accessToken = coach.microsoftCalendar.accessToken!;
  const expiry = coach.microsoftCalendar.tokenExpiry?.getTime() ?? 0;

  if (Date.now() >= expiry - 60_000) {
    const msalClient = getMsalClient();
    const result = await msalClient.acquireTokenByRefreshToken({
      refreshToken: coach.microsoftCalendar.refreshToken,
      scopes: SCOPES,
    });
    if (!result) throw new Error('Failed to refresh Microsoft token');

    accessToken = result.accessToken;
    await User.findByIdAndUpdate(coachId, {
      'microsoftCalendar.accessToken': accessToken,
      'microsoftCalendar.tokenExpiry': result.expiresOn ? new Date(result.expiresOn) : undefined,
    });
  }

  return Client.init({ authProvider: (done) => done(null, accessToken) });
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

function notificationUrl(): string {
  const base = config.booking.publicApiBaseUrl || config.booking.apiBaseUrl;
  return `${base.replace(/\/$/, '')}/api/webhooks/outlook`;
}

// ─── Subscription lifecycle ────────────────────────────────────────────────

export async function registerMicrosoftWebhook(coachId: string): Promise<void> {
  if (!config.booking.webhooksEnabled) {
    console.info(`[MS-Webhook] Skipped registration for ${coachId} — feature flag OFF`);
    return;
  }

  const calendarId = await resolveTargetCalendarId(coachId);
  if (!calendarId) {
    console.info(`[MS-Webhook] No target calendar for ${coachId} — skipping`);
    return;
  }

  await stopMicrosoftWebhook(coachId, { silent: true });

  const client = await getGraphClient(coachId);

  // Microsoft caps subscription lifetime at ~4230 minutes (~3 days)
  const expiration = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 - 60_000);

  try {
    const subscription = await client.api('/subscriptions').post({
      changeType: 'created,updated,deleted',
      notificationUrl: notificationUrl(),
      resource: `me/calendars/${calendarId}/events`,
      expirationDateTime: expiration.toISOString(),
      clientState: config.booking.microsoftWebhookSecret || undefined,
    });

    await WebhookState.findOneAndUpdate(
      { coachId, calendarId },
      {
        coachId, calendarId,
        provider: 'microsoft',
        channelId: subscription.id,
        resourceId: '',
        expiration: new Date(subscription.expirationDateTime),
        lastProcessedAt: new Date(),
      },
      { upsert: true, new: true },
    );

    console.info(
      `[MS-Webhook] Registered subscription ${subscription.id} for coach ${coachId} (expires ${subscription.expirationDateTime})`,
    );
  } catch (err) {
    console.error(`[MS-Webhook] Failed to register subscription for ${coachId}:`, err);
  }
}

export async function stopMicrosoftWebhook(
  coachId: string,
  opts: { silent?: boolean } = {},
): Promise<void> {
  const state = await WebhookState.findOne({ coachId, provider: 'microsoft' });
  if (!state) return;

  if (config.booking.webhooksEnabled) {
    try {
      const client = await getGraphClient(coachId);
      await client.api(`/subscriptions/${state.channelId}`).delete();
    } catch (err) {
      const status = (err as { statusCode?: number })?.statusCode;
      if (status === 404) {
        if (!opts.silent) console.info(`[MS-Webhook] Subscription ${state.channelId} already gone`);
      } else if (!opts.silent) {
        console.error(`[MS-Webhook] Failed to stop subscription ${state.channelId}:`, err);
      }
    }
  }

  await WebhookState.deleteOne({ _id: state._id });
  if (!opts.silent) {
    console.info(`[MS-Webhook] Stopped subscription for coach ${coachId}`);
  }
}

export async function renewExpiringMicrosoftWebhooks(): Promise<void> {
  if (!config.booking.webhooksEnabled) return;

  // Microsoft subscriptions last ~3 days; renew any expiring within 12 hours
  const soon = new Date(Date.now() + 12 * 60 * 60 * 1000);
  const expiring = await WebhookState.find({
    provider: 'microsoft',
    expiration: { $lte: soon },
  });

  for (const s of expiring) {
    try {
      await registerMicrosoftWebhook(s.coachId.toString());
    } catch (err) {
      console.error(`[MS-Webhook] Renewal failed for ${s.coachId}:`, err);
    }
  }
}

// ─── Notification handling ─────────────────────────────────────────────────

export async function handleMicrosoftNotification(body: {
  value?: Array<{
    subscriptionId?: string;
    clientState?: string;
    changeType?: string;
    resource?: string;
    resourceData?: {
      id?: string;
      '@odata.type'?: string;
    };
  }>;
}): Promise<void> {
  const notifications = body.value || [];

  for (const notification of notifications) {
    const { subscriptionId, clientState, changeType, resourceData } = notification;

    if (!subscriptionId) continue;

    // Validate clientState
    if (config.booking.microsoftWebhookSecret && clientState !== config.booking.microsoftWebhookSecret) {
      console.warn(`[MS-Webhook] clientState mismatch for subscription ${subscriptionId} — ignoring`);
      continue;
    }

    const state = await WebhookState.findOne({ channelId: subscriptionId, provider: 'microsoft' });
    if (!state) {
      console.warn(`[MS-Webhook] Unknown subscription ${subscriptionId} — ignoring`);
      continue;
    }

    const coachId = state.coachId.toString();
    const eventId = resourceData?.id;

    if (!eventId) {
      console.info(`[MS-Webhook] No event ID in notification for ${coachId} — skipping`);
      continue;
    }

    const booking = await Booking.findOne({ googleEventId: eventId })
      .setOptions({ bypassTenantCheck: true });
    if (!booking) {
      console.info(`[MS-Webhook] Event ${eventId} (${changeType}) — no matching booking, skipping`);
      continue;
    }

    try {
      if (changeType === 'deleted') {
        if (booking.status === 'confirmed') {
          await cancelBooking(booking._id.toString(), 'coach', 'Cancelled via Microsoft Calendar');
          console.info(`[MS-Webhook] Booking ${booking._id} auto-cancelled via Outlook`);
        }
        continue;
      }

      if (changeType === 'updated') {
        // Fetch the updated event to get new times
        const client = await getGraphClient(coachId);
        let event;
        try {
          event = await client.api(`/me/events/${eventId}`)
            .select('start,end,isCancelled')
            .get();
        } catch (fetchErr) {
          const status = (fetchErr as { statusCode?: number })?.statusCode;
          if (status === 404) {
            // Event was deleted — treat as cancellation
            if (booking.status === 'confirmed') {
              await cancelBooking(booking._id.toString(), 'coach', 'Cancelled via Microsoft Calendar');
              console.info(`[MS-Webhook] Booking ${booking._id} auto-cancelled (event gone)`);
            }
            continue;
          }
          throw fetchErr;
        }

        if (event.isCancelled) {
          if (booking.status === 'confirmed') {
            await cancelBooking(booking._id.toString(), 'coach', 'Cancelled via Microsoft Calendar');
            console.info(`[MS-Webhook] Booking ${booking._id} auto-cancelled via Outlook`);
          }
          continue;
        }

        const newStartStr = event.start?.dateTime;
        const newEndStr = event.end?.dateTime;
        if (!newStartStr || !newEndStr) continue;

        // Microsoft returns local time without Z when timeZone is specified
        const newStart = new Date(newStartStr.endsWith('Z') ? newStartStr : newStartStr + 'Z');
        const newEnd = new Date(newEndStr.endsWith('Z') ? newEndStr : newEndStr + 'Z');

        const startMoved = newStart.getTime() !== booking.startTime.getTime();
        const endMoved = newEnd.getTime() !== booking.endTime.getTime();

        if ((startMoved || endMoved) && booking.status === 'confirmed') {
          if (newStart.getTime() <= Date.now()) {
            console.info(`[MS-Webhook] Skipping past reschedule for booking ${booking._id}`);
            continue;
          }
          await rescheduleBooking(booking._id.toString(), newStart, newEnd, 'coach_gcal');
          console.info(`[MS-Webhook] Booking ${booking._id} rescheduled via Outlook`);
        }
      }
    } catch (err) {
      console.error(`[MS-Webhook] Failed to process event ${eventId} for booking ${booking._id}:`, err);
    }
  }

  // Flush slot cache for all affected coaches
  const coachIds = new Set(
    notifications
      .filter((n) => n.subscriptionId)
      .map((n) => n.subscriptionId!),
  );
  for (const subId of coachIds) {
    const state = await WebhookState.findOne({ channelId: subId, provider: 'microsoft' });
    if (state) {
      const cfg = await AvailabilityConfig.findOne({ coachId: state.coachId })
        .setOptions({ bypassTenantCheck: true });
      if (cfg) invalidateSlotCache(cfg.coachSlug);
    }
  }
}
