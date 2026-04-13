import { Router, Response, NextFunction, Request } from 'express';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth.middleware';
import { tenantResolver } from '../middleware/tenant.middleware';
import { config } from '../config/env';
import { User } from '../models/User.model';
import {
  getAuthUrl,
  exchangeCodeForTokens,
  listCoachCalendars,
} from '../services/googleCalendar.service';
import {
  registerGoogleWebhook,
  stopGoogleWebhook,
} from '../services/calendarWebhook.service';

// ── Public callback (no auth required — Google redirects here) ──────────────
export const calendarCallbackRouter = Router();

calendarCallbackRouter.get('/auth/google/callback', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const code = req.query['code'] as string;
    const userId = req.query['state'] as string;
    if (!code || !userId) {
      res.status(400).json({ error: 'Missing code or state' });
      return;
    }

    await exchangeCodeForTokens(code, userId);

    // Redirect to the frontend settings page
    res.redirect(`${config.frontendUrl}/settings?calendarConnected=true`);
  } catch (e) { next(e); }
});

// ── Protected routes ────────────────────────────────────────────────────────
const router = Router();
router.use(authenticateToken, tenantResolver);

/** Generate Google OAuth consent URL. */
router.get(
  '/auth/google',
  requireRole('coach'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const url = getAuthUrl(req.user!.userId);
      res.json({ url });
    } catch (e) { next(e); }
  },
);

/** List the coach's Google calendars (for the calendar picker). */
router.get(
  '/calendars',
  requireRole('coach'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const calendars = await listCoachCalendars(req.user!.userId);
      res.json(calendars);
    } catch (e) { next(e); }
  },
);

/** Save the selected calendar. */
router.post(
  '/select',
  requireRole('coach'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { calendarId, calendarName } = req.body;
      if (!calendarId) {
        res.status(400).json({ error: 'calendarId is required' });
        return;
      }
      await User.findByIdAndUpdate(req.user!.userId, {
        'googleCalendar.calendarId': calendarId,
        'googleCalendar.calendarName': calendarName || calendarId,
      });

      // (Re-)register the push-notification channel for the new target calendar.
      // No-op when webhooks are disabled by config.
      registerGoogleWebhook(req.user!.userId).catch((err) =>
        console.error('[Webhook] post-select registration failed:', err),
      );

      res.json({ message: 'Calendar selected', calendarId, calendarName });
    } catch (e) { next(e); }
  },
);

/** Disconnect Google Calendar — remove tokens. */
router.delete(
  '/disconnect',
  requireRole('coach'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      // Stop the push-notification channel before we lose the tokens.
      await stopGoogleWebhook(req.user!.userId).catch((err) =>
        console.error('[Webhook] stop on disconnect failed:', err),
      );

      await User.findByIdAndUpdate(req.user!.userId, {
        'googleCalendar.connected': false,
        'googleCalendar.accessToken': null,
        'googleCalendar.refreshToken': null,
        'googleCalendar.tokenExpiry': null,
        'googleCalendar.calendarId': null,
        'googleCalendar.calendarName': null,
      });
      res.json({ message: 'Google Calendar disconnected' });
    } catch (e) { next(e); }
  },
);

/** Return the coach's calendar connection status. */
router.get(
  '/status',
  requireRole('coach'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const user = await User.findById(req.user!.userId).select('googleCalendar');
      const gc = user?.googleCalendar;
      res.json({
        connected: gc?.connected ?? false,
        calendarId: gc?.calendarId ?? null,
        calendarName: gc?.calendarName ?? null,
      });
    } catch (e) { next(e); }
  },
);

export default router;
