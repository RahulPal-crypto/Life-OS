import rateLimit from 'express-rate-limit';
import { sendError } from '../utils/apiResponse.js';
import { env } from '../config/env.js';

const createLimiter = ({ windowMs, max, message, code }) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => sendError(res, message, 429, code),
  });

export const apiRateLimiter = createLimiter({
  windowMs: env.rateLimit.windowMs,
  max: env.rateLimit.max,
  message: 'Too many API requests from this IP. Please try again later.',
  code: 'RATE_LIMIT_EXCEEDED',
});

export const authRateLimiter = createLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 requests per 15 minutes per IP
  message: 'Too many authentication requests from this IP. Please try again after 15 minutes.',
  code: 'TOO_MANY_REQUESTS',
});

export const strictLoginLimiter = createLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 login attempts per 15 minutes per IP
  message: 'Too many failed login attempts. Please wait 15 minutes before trying again.',
  code: 'TOO_MANY_LOGIN_ATTEMPTS',
});
