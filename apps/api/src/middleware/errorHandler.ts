import type { NextFunction, Request, Response } from 'express';

import { env } from '../config/env.js';
import { fail } from '../lib/envelope.js';
import { AppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import type { ApiError } from '../types/envelope.js';

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const requestId = (res.locals.requestId as string | undefined) ?? 'unknown';
  const startTime = (res.locals.startTime as number | undefined) ?? Date.now();
  const log = req.log ?? logger.child({ requestId });

  let appError: AppError;
  if (err instanceof AppError) {
    appError = err;
  } else {
    log.error({ err }, 'Unhandled error');
    appError = AppError.internal(
      env.NODE_ENV === 'production' ? 'Internal server error' : 'Internal server error',
    );
  }

  if (!(err instanceof AppError) || !err.isOperational) {
    log.error({ err, code: appError.code }, 'Request failed');
  } else {
    log.warn({ code: appError.code, details: appError.details }, appError.message);
  }

  const apiError: ApiError = {
    code: appError.code,
    message: appError.message,
    ...(appError.details !== undefined ? { details: appError.details } : {}),
  };

  res.status(appError.httpStatus).json(
    fail(apiError, {
      requestId,
      startTime,
      source: 'live',
      cached: false,
    }),
  );
}
