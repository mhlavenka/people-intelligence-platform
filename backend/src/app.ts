import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import { config } from './config/env';
import { connectDatabase } from './config/database';
import { errorHandler, notFound } from './middleware/error.middleware';
import { generalLimiter } from './middleware/rateLimiter.middleware';
import { initI18n, i18nMiddleware } from './middleware/i18n.middleware';

// Routes
import authRoutes from './routes/auth.routes';
import organizationRoutes from './routes/organization.routes';
import userRoutes from './routes/user.routes';
import surveyRoutes from './routes/survey.routes';
import conflictRoutes from './routes/conflict.routes';
import neuroinclustionRoutes from './routes/neuroinclusion.routes';
import successionRoutes from './routes/succession.routes';
import aiRoutes from './routes/ai.routes';
import systemAdminRoutes from './routes/system-admin.routes';
import hubRoutes from './routes/hub.routes';
import billingRoutes from './routes/billing.routes';
import systemAdminBillingRoutes from './routes/system-admin-billing.routes';
import orgChartRoutes from './routes/org-chart.routes';
import dashboardRoutes from './routes/dashboard.routes';
import plansRoutes from './routes/plans.routes';
import rolesRoutes from './routes/roles.routes';
import authPasskeyRoutes from './routes/auth-passkey.routes';
import reportsRoutes from './routes/reports.routes';
import eqiImportRoutes from './routes/eqi-import.routes';
import coachingRoutes from './routes/coaching.routes';
import authOAuthRoutes from './routes/auth-oauth.routes';
import systemAdminSettingsRoutes from './routes/system-admin-settings.routes';
import calendarRoutes, { calendarCallbackRouter } from './routes/calendar.routes';
import bookingRoutes, { publicBookingRouter, publicCoachRouter } from './routes/booking.routes';
import sponsorRoutes from './routes/sponsor.routes';
import journalRoutes from './routes/journal.routes';
import { webhookRouter } from './routes/webhook.routes';
import { startReminderJob } from './jobs/reminder.job';
import { startWebhookRenewalJob } from './jobs/webhookRenewal.job';
import { startTrialRevertJob } from './jobs/trialRevert.job';
import { startPreSessionIntakeJob } from './jobs/preSessionIntake.job';

const app = express();

// Apache proxies all traffic to this process on localhost, so without
// `trust proxy` Express sees every req.ip as 127.0.0.1 and the rate-limiter
// buckets all users into a single shared counter — which fills fast and
// returns 429 on /login, /refresh, and everything else until PM2 restart.
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());
app.use(
  cors({
    origin: config.frontendUrl,
    credentials: true,
  })
);

// Raw body for Stripe webhook (must come BEFORE the json() middleware)
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// i18n
app.use(i18nMiddleware);

// Rate limiting
app.use('/api', generalLimiter);

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok', env: config.nodeEnv }));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/auth/passkey', authPasskeyRoutes);
app.use('/api/auth/oauth', authOAuthRoutes);
app.use('/api/organizations', organizationRoutes);
app.use('/api/users', userRoutes);
app.use('/api/surveys', surveyRoutes);
app.use('/api/conflict', conflictRoutes);
app.use('/api/neuroinclusion', neuroinclustionRoutes);
app.use('/api/succession', successionRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/system-admin', systemAdminRoutes);
app.use('/api/hub', hubRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/system-admin/billing', systemAdminBillingRoutes);
app.use('/api/org-chart', orgChartRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/plans', plansRoutes);
app.use('/api/roles', rolesRoutes);
app.use('/api/system-admin/settings', systemAdminSettingsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/eq/import', eqiImportRoutes);
app.use('/api/coaching', coachingRoutes);
app.use('/api/calendar', calendarCallbackRouter);  // public — Google OAuth redirect (no auth)
app.use('/api/calendar', calendarRoutes);
app.use('/api/journal', journalRoutes);
app.use('/api/public/booking', publicBookingRouter);
app.use('/api/public/coach', publicCoachRouter);
app.use('/api/booking', bookingRoutes);
app.use('/api/sponsors', sponsorRoutes);
app.use('/api/webhooks', webhookRouter); // public — Google push notifications (no auth)

// 404 and error handlers (must be last)
app.use(notFound);
app.use(errorHandler);

// Start server
async function bootstrap(): Promise<void> {
  await initI18n();
  await connectDatabase();
  startReminderJob();
  startWebhookRenewalJob();
  startTrialRevertJob();
  startPreSessionIntakeJob();
  app.listen(config.port, () => {
    console.log(`[Server] Running on port ${config.port} [${config.nodeEnv}]`);
  });
}

bootstrap().catch(console.error);

export default app;
