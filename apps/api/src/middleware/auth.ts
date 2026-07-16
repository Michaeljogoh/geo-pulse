import type { NextFunction, Request, Response } from 'express';

/**
 * Phase 14 — Firebase ID token auth.
 * `requireAuth` / `optionalAuth` middleware.
 */
export function requireAuth(_req: Request, _res: Response, next: NextFunction): void {
  next(new Error('Not implemented: requireAuth (Phase 14)'));
}

export function optionalAuth(_req: Request, _res: Response, next: NextFunction): void {
  next();
}
