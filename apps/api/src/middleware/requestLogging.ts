import type { NextFunction, Request, Response } from 'express';

import { resolveClientIp } from '../lib/clientIp.js';
import { createRequestLog } from '../repositories/requestLogRepository.js';

/**
 * Fire-and-forget write to `request_logs` after the response finishes.
 * Never delays or fails the response path.
 */
export function requestLogging(req: Request, res: Response, next: NextFunction): void {
  res.on('finish', () => {
    const startTime = res.locals.startTime ?? Date.now();
    void createRequestLog({
      requestId: res.locals.requestId ?? 'unknown',
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      ip: resolveClientIp(req) || null,
      country: res.locals.country ?? null,
      provider: res.locals.provider ?? null,
      cacheStatus: res.locals.cacheStatus ?? 'n/a',
      latencyMs: Math.max(0, Date.now() - startTime),
      degraded: res.locals.degraded ?? false,
      userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null,
    });
  });
  next();
}
