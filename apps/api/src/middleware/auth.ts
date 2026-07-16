import type { NextFunction, Request, Response } from 'express';

import { env } from '../config/env.js';
import { AppError } from '../lib/errors.js';
import type { AuthUser } from '../types/domain.js';

/** Fixed local-only user when AUTH_ENABLED=false (never in production). */
export const DEV_AUTH_USER: AuthUser = {
  uid: 'dev-local-user',
  email: 'dev@localhost',
  name: 'Local Dev User',
  picture: null,
};

function extractBearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (!scheme || !token || scheme.toLowerCase() !== 'bearer' || token.trim() === '') {
    return null;
  }
  return token.trim();
}

/**
 * Require a verified Firebase ID token (Section 9.9 / Phase 14).
 * When AUTH_ENABLED=false and NODE_ENV !== production, injects DEV_AUTH_USER.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!env.AUTH_ENABLED) {
      if (env.NODE_ENV === 'production') {
        next(AppError.internal('AUTH_ENABLED=false is not allowed in production'));
        return;
      }
      res.locals.user = DEV_AUTH_USER;
      next();
      return;
    }

    const token = extractBearerToken(req.header('authorization'));
    if (!token) {
      next(AppError.unauthenticated('Missing or invalid Authorization Bearer token'));
      return;
    }

    // Phase 14: verify with admin.auth().verifyIdToken(token)
    // Until Firebase Admin is wired (Phase 6/14), tokens cannot be verified.
    next(AppError.unauthenticated('Token verification not configured (Phase 14)'));
  } catch (err) {
    next(err);
  }
}

/** Attach user if a valid token is present; otherwise continue anonymously. */
export async function optionalAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!env.AUTH_ENABLED) {
      if (env.NODE_ENV !== 'production') {
        res.locals.user = DEV_AUTH_USER;
      }
      next();
      return;
    }

    const token = extractBearerToken(req.header('authorization'));
    if (!token) {
      next();
      return;
    }

    // Phase 14 will verify and set res.locals.user; ignore invalid tokens for optional.
    next();
  } catch (err) {
    next(err);
  }
}
