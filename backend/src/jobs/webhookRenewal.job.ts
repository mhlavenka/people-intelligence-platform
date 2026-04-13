import cron from 'node-cron';
import { config } from '../config/env';
import { renewExpiringWebhooks } from '../services/calendarWebhook.service';

/**
 * Google Calendar push-notification channels expire. Re-register any
 * channel whose TTL is within 2 days, once per hour.
 *
 * No-op when `config.booking.webhooksEnabled` is false.
 */
export function startWebhookRenewalJob(): void {
  cron.schedule('7 * * * *', async () => {
    if (!config.booking.webhooksEnabled) return;
    try {
      await renewExpiringWebhooks();
    } catch (err) {
      console.error('[Webhook] Renewal job failed:', err);
    }
  });

  console.log('[Webhook] Channel-renewal job started (hourly)');
}
