import { Request, Response, NextFunction } from 'express';
import pino from 'pino';

const logger = pino();

export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  logger.error({
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
  }, 'Request error');

  if (error.name === 'ZodError') {
    return res.status(400).json({
      error: 'Validation error',
      details: JSON.parse(error.message),
    });
  }

  if (error.message.includes('rate limit')) {
    return res.status(429).json({
      error: 'Too many requests',
    });
  }

  res.status(500).json({
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : error.message,
  });
}