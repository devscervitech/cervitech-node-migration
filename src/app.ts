// src/app.ts
// Builds the Express application. Has no side effects (no DB connection, no
// listening socket, no jobs) so it can be exercised directly in tests;
// src/server.ts owns process startup.
import express, { Express } from 'express';
import morgan from 'morgan';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { logger } from './utils/logger';
import { swaggerSpec } from './config/swagger';
import { resolveCorsOrigin, resolveTrustProxyHops } from './config/runtime';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.middleware';
import backOfficeUser from './routes/backOfficeUser.routes';
import authRoutes from './routes/auth.routes.js';
import fcmRoutes from './routes/fcm.routes.js';
import usersRoutes from './routes/users.routes.js';
import neckAngleRoutes from './routes/neckAngle.routes';
import transactionRoutes from './routes/transaction.routes';
import goalsroutes from './routes/goals.routes.js';
import healthRoutes from './routes/health.routes';
import probeRoutes from './routes/probe.routes';

export function createApp(env: NodeJS.ProcessEnv = process.env): Express {
  const app = express();
  app.set('trust proxy', resolveTrustProxyHops(env));

  const corsOrigin = resolveCorsOrigin(env);
  if (!env.FRONTEND_URL?.trim()) {
    logger.warn(
      corsOrigin
        ? `FRONTEND_URL is not set; allowing CORS from ${corsOrigin} for local development only.`
        : 'FRONTEND_URL is not set; cross-origin browser requests are disabled.'
    );
  }

  // The liveness probe comes before request logging so the 30s Docker
  // healthcheck does not flood the logs.
  app.use(probeRoutes);

  // Middleware
  app.use(express.json());
  app.use(
    morgan(':method :url :status :response-time ms - :res[content-length]', {
      stream: logger.stream,
    })
  );

  app.use(
    cors({
      origin: corsOrigin ? [corsOrigin] : false,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      credentials: true, // if you use cookies or auth headers
    })
  );

  // API docs
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.get('/api-docs.json', (req, res) => res.json(swaggerSpec));

  // Routes
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/fcm', fcmRoutes);
  app.use('/api/v1/users', usersRoutes);
  app.use('/api/v1/neck-angle', neckAngleRoutes);
  app.use('/api/v1/backoffice-users', backOfficeUser);
  app.use('/api/v1/transaction', transactionRoutes);
  app.use('/api/v1/goals', goalsroutes);
  app.use('/api/v1/health', healthRoutes);

  // Must stay last.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
