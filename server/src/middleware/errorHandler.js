import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';

export function errorHandler(err, req, res, _next) {
  const status = err.statusCode || err.status || 500;
  const code = err.code || (status === 404 ? 'NOT_FOUND' : 'INTERNAL_SERVER_ERROR');
  const message = err.message || 'An unexpected error occurred';

  logger.error(`${req.method} ${req.originalUrl} - ${status} ${code}: ${message}`, {
    stack: env.NODE_ENV !== 'production' ? err.stack : undefined
  });

  const responseBody = {
    error: {
      code: typeof code === 'string' ? code : 'INTERNAL_SERVER_ERROR',
      message
    }
  };

  if (err.details) {
    responseBody.error.details = err.details;
  }

  res.status(status).json(responseBody);
}

export function notFoundHandler(req, res) {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Cannot ${req.method} ${req.originalUrl}`
    }
  });
}
