import cron from 'node-cron';
import { config } from '../config/env';
import { renewExpiringWebhooks } from '../services/calendarWebhook.service';
import { renewExpiringMicrosoftWebhooks } from '../services/microsoftWebhook.service';

/**
 * Calendar push-notification channels/subscriptions expire.
 *
 * Google: ~30 day TTL, check hourly, renew within 2 days of expiry.
 * Microsoft: ~3 day TTL, check every 4 hours, renew within 12 hours of expiry.
 *
 * No-op when `config.booking.webhooksEnabled` is false.
 */
export function startWebhookRenewalJob(): void {
  // Google renewal — hourly
  cron.schedule('7 * * * *', async () => {
    if (!config.booking.webhooksEnabled) return;
    try {
      await renewExpiringWebhooks();
    } catch (err) {
      console.error('[Webhook] Google renewal job failed:', err);
    }
  });

  // Microsoft renewal — every 4 hours (3-day TTL, renew within 12h)
  cron.schedule('37 */4 * * *', async () => {
    if (!config.booking.webhooksEnabled) return;
    try {
      await renewExpiringMicrosoftWebhooks();
    } catch (err) {
      console.error('[Webhook] Microsoft renewal job failed:', err);
    }
  });

  console.log('[Webhook] Channel-renewal jobs started (Google: hourly, Microsoft: every 4h)');
}
