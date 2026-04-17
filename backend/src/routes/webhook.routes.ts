import { Router, Request, Response } from 'express';
import { handleGoogleNotification } from '../services/calendarWebhook.service';
import { handleMicrosoftNotification } from '../services/microsoftWebhook.service';

/**
 * Public router for inbound calendar push notifications.
 *
 * Mounted at /api/webhooks — Apache must proxy this path to PM2.
 * No auth/JWT here (providers call us directly), but each handler validates
 * its own tokens/secrets before doing anything.
 *
 * Always returns 200/202 quickly so providers don't back off and retry.
 * All meaningful work happens asynchronously after the response is flushed.
 */
export const webhookRouter = Router();

// ── Google Calendar push notifications ─────────────────────────────────────
webhookRouter.post('/gcal', (req: Request, res: Response) => {
  const headers = {
    channelId: req.header('X-Goog-Channel-ID') || undefined,
    resourceId: req.header('X-Goog-Resource-ID') || undefined,
    resourceState: req.header('X-Goog-Resource-State') || undefined,
    channelToken: req.header('X-Goog-Channel-Token') || undefined,
  };

  console.info(`[Webhook] Incoming GCal: state=${headers.resourceState} channel=${headers.channelId?.slice(-12)}`);

  res.status(200).end();

  handleGoogleNotification(headers).catch((err) => {
    console.error('[Webhook] GCal handler crashed:', err);
  });
});

// ── Microsoft Graph change notifications ───────────────────────────────────
webhookRouter.post('/outlook', (req: Request, res: Response) => {
  // Microsoft sends a validation request when creating a subscription.
  // It includes ?validationToken=xxx — we must echo it back as plain text.
  const validationToken = req.query['validationToken'] as string | undefined;
  if (validationToken) {
    console.info('[Webhook] Microsoft validation request — echoing token');
    res.set('Content-Type', 'text/plain');
    res.status(200).send(validationToken);
    return;
  }

  console.info(`[Webhook] Incoming Outlook: ${(req.body?.value || []).length} notification(s)`);

  res.status(202).end();

  handleMicrosoftNotification(req.body || {}).catch((err) => {
    console.error('[Webhook] Outlook handler crashed:', err);
  });
});
