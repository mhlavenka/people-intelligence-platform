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

const app = express();

// Security middleware
app.use(helmet());
app.use(
  cors({
    origin: config.frontendUrl,
    credentials: true,
  })
);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
app.use('/api', generalLimiter);

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok', env: config.nodeEnv }));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/organizations', organizationRoutes);
app.use('/api/users', userRoutes);
app.use('/api/surveys', surveyRoutes);
app.use('/api/conflict', conflictRoutes);
app.use('/api/neuroinclusion', neuroinclustionRoutes);
app.use('/api/succession', successionRoutes);
app.use('/api/ai', aiRoutes);

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
