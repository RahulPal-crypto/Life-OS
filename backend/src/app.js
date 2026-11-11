import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import authRoutes from './modules/auth/auth.routes.js';
import profileRoutes from './modules/profile/profile.routes.js';
import myDayRoutes from './modules/myDay/myDay.routes.js';
import { notFoundHandler, errorHandler } from './middlewares/errorHandler.js';
import { apiRateLimiter } from './middlewares/rateLimiter.js';
import { sendSuccess } from './utils/apiResponse.js';

const app = express();

// Security & Parsing Middlewares
app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Health Check Endpoint
app.get('/health', (req, res) => {
  return sendSuccess(res, 'LIFE OS API Server is healthy and running.', {
    status: 'UP',
    version: '1.0.0',
    environment: env.nodeEnv,
    timestamp: new Date().toISOString(),
  });
});

app.get(env.apiPrefix, (req, res) => {
  return sendSuccess(res, 'Welcome to LIFE OS Modular Monolith API v1.', {
    documentation: '/api/v1/docs',
    availableModules: ['auth', 'profile', 'my-day'],
  });
});

// Mount Modules
app.use(env.apiPrefix, apiRateLimiter);
app.use(`${env.apiPrefix}/auth`, authRoutes);
app.use(`${env.apiPrefix}/profile`, profileRoutes);
app.use(`${env.apiPrefix}/my-day`, myDayRoutes);

// Fallback & Error Handling Middlewares
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
