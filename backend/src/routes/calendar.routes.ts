import { Router, Response, NextFunction, Request } from 'express';
import { authenticateToken, requirePermission, AuthRequest } from '../middleware/auth.middleware';
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
import { getCalendarProvider, getCoachCalendarProvider } from '../services/calendar';

// ── Public callbacks (no auth required — OAuth providers redirect here) ─────
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

    res.redirect(`${config.frontendUrl}/booking/settings?calendarConnected=true`);
  } catch (e) { next(e); }
});

calendarCallbackRouter.get('/auth/microsoft/callback', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const code = req.query['code'] as string;
    const userId = req.query['state'] as string;
    if (!code || !userId) {
      res.status(400).json({ error: 'Missing code or state' });
      return;
    }

    const provider = getCalendarProvider('microsoft');
    await provider.exchangeCodeForTokens(code, userId);

    res.redirect(`${config.frontendUrl}/booking/settings?calendarConnected=true&provider=microsoft`);
  } catch (e) { next(e); }
});

// ── Protected routes ────────────────────────────────────────────────────────
const router = Router();
router.use(authenticateToken, tenantResolver);

/** Generate Google OAuth consent URL. */
router.get(
  '/auth/google',
  requirePermission('MANAGE_CALENDAR'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const url = getAuthUrl(req.user!.userId);
      res.json({ url });
    } catch (e) { next(e); }
  },
);

/** Generate Microsoft OAuth consent URL. */
router.get(
  '/auth/microsoft',
  requirePermission('MANAGE_CALENDAR'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const provider = getCalendarProvider('microsoft');
      const url = provider.getAuthUrl(req.user!.userId);
      res.json({ url });
    } catch (e) { next(e); }
  },
);

/** List the coach's calendars (from whichever provider is connected). */
router.get(
  '/calendars',
  requirePermission('MANAGE_CALENDAR'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const cp = await getCoachCalendarProvider(req.user!.userId);
      if (!cp) {
        // Fall back to Google legacy path for backward compat
        const calendars = await listCoachCalendars(req.user!.userId);
        res.json(calendars);
        return;
      }
      const calendars = await cp.provider.listCalendars(req.user!.userId);
      // Normalize to { id, summary } for backward compat with frontend
      res.json(calendars.map((c) => ({ id: c.id, summary: c.name })));
    } catch (e) { next(e); }
  },
);

/** Save the selected calendar. */
router.post(
  '/select',
  requirePermission('MANAGE_CALENDAR'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { calendarId, calendarName } = req.body;
      if (!calendarId) {
        res.status(400).json({ error: 'calendarId is required' });
        return;
      }

      const user = await User.findById(req.user!.userId).select('googleCalendar.connected microsoftCalendar.connected');
      if (user?.microsoftCalendar?.connected) {
        await User.findByIdAndUpdate(req.user!.userId, {
          'microsoftCalendar.calendarId': calendarId,
          'microsoftCalendar.calendarName': calendarName || calendarId,
        });
      } else {
        await User.findByIdAndUpdate(req.user!.userId, {
          'googleCalendar.calendarId': calendarId,
          'googleCalendar.calendarName': calendarName || calendarId,
        });
        registerGoogleWebhook(req.user!.userId).catch((err) =>
          console.error('[Webhook] post-select registration failed:', err),
        );
      }

      res.json({ message: 'Calendar selected', calendarId, calendarName });
    } catch (e) { next(e); }
  },
);

/** Disconnect calendar — remove tokens for whichever provider is connected. */
router.delete(
  '/disconnect',
  requirePermission('MANAGE_CALENDAR'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const user = await User.findById(req.user!.userId).select('googleCalendar.connected microsoftCalendar.connected');

      if (user?.microsoftCalendar?.connected) {
        await User.findByIdAndUpdate(req.user!.userId, {
          'microsoftCalendar.connected': false,
          'microsoftCalendar.accessToken': null,
          'microsoftCalendar.refreshToken': null,
          'microsoftCalendar.tokenExpiry': null,
          'microsoftCalendar.calendarId': null,
          'microsoftCalendar.calendarName': null,
        });
        res.json({ message: 'Microsoft Calendar disconnected' });
      } else {
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
      }
    } catch (e) { next(e); }
  },
);

/** Return the coach's calendar connection status. */
router.get(
  '/status',
  requirePermission('MANAGE_CALENDAR'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const user = await User.findById(req.user!.userId).select('googleCalendar microsoftCalendar');
      const gc = user?.googleCalendar;
      const mc = user?.microsoftCalendar;
      if (gc?.connected) {
        res.json({
          connected: true,
          provider: 'google',
          calendarId: gc.calendarId ?? null,
          calendarName: gc.calendarName ?? null,
        });
      } else if (mc?.connected) {
        res.json({
          connected: true,
          provider: 'microsoft',
          calendarId: mc.calendarId ?? null,
          calendarName: mc.calendarName ?? null,
        });
      } else {
        res.json({ connected: false, provider: null, calendarId: null, calendarName: null });
      }
    } catch (e) { next(e); }
  },
);

export default router;
