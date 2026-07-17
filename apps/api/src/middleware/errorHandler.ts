import type { NextFunction, Request, Response } from 'express';

import { env } from '../config/env.js';
import { fail } from '../lib/envelope.js';
import { AppError, isAppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

/**
 * Maps thrown errors into the standard API error envelope.
 * Unknown errors → INTERNAL; never leak stacks or upstream bodies to clients in production.
 * Upstream `details` stay on AppError for server logs only (`toApiError` strips them).
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const requestId = res.locals.requestId ?? 'unknown';
  const startTime = res.locals.startTime ?? Date.now();
  const log = req.log ?? logger.child({ requestId });

  let appError: AppError;

  if (isAppError(err)) {
    appError = err;
    if (err.isOperational) {
      log.warn({ code: err.code, details: err.details }, err.message);
    } else {
      log.error({ err, code: err.code }, 'Non-operational AppError');
    }
  } else {
    log.error({ err }, 'Unhandled error');
    const safeMessage =
      env.NODE_ENV === 'production'
        ? 'Internal server error'
        : err instanceof Error
          ? err.message
          : 'Internal server error';
    appError = AppError.internal(safeMessage);
  }

  res.status(appError.httpStatus).json(
    fail(appError.toApiError(), {
      requestId,
      startTime,
      source: 'live',
      cached: false,
    }),
  );
}
