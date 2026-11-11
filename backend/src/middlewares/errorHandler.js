import { sendError } from '../utils/apiResponse.js';
import { env } from '../config/env.js';

export const notFoundHandler = (req, res) => {
  return sendError(
    res,
    `Route ${req.method} ${req.originalUrl} not found on this server.`,
    404,
    'ROUTE_NOT_FOUND'
  );
};

export const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  if (statusCode >= 500) {
    console.error('[Internal Server Error]:', err);
  }

  const message = err.message || 'Internal server error occurred.';
  const code = err.code || 'INTERNAL_SERVER_ERROR';

  return sendError(
    res,
    message,
    statusCode,
    code,
    env.nodeEnv === 'development' && statusCode >= 500 ? err.stack : null
  );
};
