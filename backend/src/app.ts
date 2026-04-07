import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config/env';
import { connectDatabase } from './config/database';
import { errorHandler, notFound } from './middleware/error.middleware';
import { generalLimiter } from './middleware/rateLimiter.middleware';

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
import authOAuthRoutes from './routes/auth-oauth.routes';
import systemAdminSettingsRoutes from './routes/system-admin-settings.routes';

const app = express();

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

// 404 and error handlers (must be last)
app.use(notFound);
app.use(errorHandler);

// Start server
async function bootstrap(): Promise<void> {
  await connectDatabase();
  app.listen(config.port, () => {
    console.log(`[Server] Running on port ${config.port} [${config.nodeEnv}]`);
  });
}

bootstrap().catch(console.error);

export default app;
