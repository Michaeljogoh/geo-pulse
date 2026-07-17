import type { NextFunction, Request, Response } from 'express';

import { env } from '../config/env.js';
import { AppError } from '../lib/errors.js';
import { verifyFirebaseIdToken } from '../lib/firebaseAuth.js';
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

async function authenticateBearer(token: string): Promise<AuthUser> {
  try {
    return await verifyFirebaseIdToken(token);
  } catch {
    throw AppError.unauthenticated('Invalid or expired Firebase ID token');
  }
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

    res.locals.user = await authenticateBearer(token);
    next();
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

    try {
      res.locals.user = await authenticateBearer(token);
    } catch {
      // Invalid token → continue anonymously (optional auth).
    }
    next();
  } catch (err) {
    next(err);
  }
}
