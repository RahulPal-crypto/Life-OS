import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import authRoutes from './modules/auth/auth.routes.js';
import profileRoutes from './modules/profile/profile.routes.js';
import myDayRoutes from './modules/myDay/myDay.routes.js';
import appRoutes from './modules/app/app.routes.js';
import { notFoundHandler, errorHandler } from './middlewares/errorHandler.js';
import { apiRateLimiter } from './middlewares/rateLimiter.js';
import { sendSuccess, sendError } from './utils/apiResponse.js';
import { pingDatabase } from './config/db.js';

const app = express();

// Trust reverse-proxy headers (X-Forwarded-For) so rate limiting uses the real client IP
app.set('trust proxy', env.trustProxy);

// Security & Parsing Middlewares
app.use(helmet());
app.use(cors({ origin: env.corsOrigin, credentials: true }));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Health Check Endpoint (verifies live DB connectivity)
app.get('/health', async (req, res) => {
  try {
    await pingDatabase();
    return sendSuccess(res, 'LIFE OS API Server is healthy and running.', {
      status: 'UP',
      database: 'UP',
      version: '1.0.0',
      environment: env.nodeEnv,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return sendError(
      res,
      'LIFE OS API Server cannot reach the database.',
      503,
      'SERVICE_UNAVAILABLE',
      env.nodeEnv === 'development' ? error.message : null
    );
  }
});

app.get(env.apiPrefix, (req, res) => {
  return sendSuccess(res, 'Welcome to LIFE OS Modular Monolith API v1.', {
    documentation: '/api/v1/docs',
    availableModules: ['auth', 'profile', 'my-day', 'app'],
  });
});

// Mount Modules
app.use(env.apiPrefix, apiRateLimiter);
app.use(`${env.apiPrefix}/auth`, authRoutes);
app.use(`${env.apiPrefix}/profile`, profileRoutes);
app.use(`${env.apiPrefix}/my-day`, myDayRoutes);
app.use(`${env.apiPrefix}/app`, appRoutes);

// Fallback & Error Handling Middlewares
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
