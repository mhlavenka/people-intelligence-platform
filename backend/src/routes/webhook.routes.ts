import { Router, Request, Response } from 'express';
import { handleGoogleNotification } from '../services/calendarWebhook.service';

/**
 * Public router for inbound Google Calendar push notifications.
 *
 * Mounted at /api/webhooks — Apache must proxy this path to PM2.
 * No auth/JWT here (Google calls us directly), but the handler validates
 * the channel id + optional shared token before doing anything.
 *
 * Always returns 200 quickly so Google doesn't back off and retry. All
 * meaningful work happens asynchronously inside the service after the
 * response is flushed.
 */
export const webhookRouter = Router();

webhookRouter.post('/gcal', (req: Request, res: Response) => {
  const headers = {
    channelId: req.header('X-Goog-Channel-ID') || undefined,
    resourceId: req.header('X-Goog-Resource-ID') || undefined,
    resourceState: req.header('X-Goog-Resource-State') || undefined,
    channelToken: req.header('X-Goog-Channel-Token') || undefined,
  };

  // Acknowledge immediately; process out-of-band.
  res.status(200).end();

  handleGoogleNotification(headers).catch((err) => {
    console.error('[Webhook] handler crashed:', err);
  });
});
