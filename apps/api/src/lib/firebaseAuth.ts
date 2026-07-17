import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';

import { env } from '../config/env.js';
import { logger } from './logger.js';
import type { AuthUser } from '../types/domain.js';

export type VerifyIdTokenFn = (token: string) => Promise<DecodedIdToken>;

let verifyOverride: VerifyIdTokenFn | null = null;
let app: App | null = null;

function usingEmulator(): boolean {
  return Boolean(process.env.FIRESTORE_EMULATOR_HOST);
}

function authAdminUnavailableInTests(): boolean {
  return env.NODE_ENV === 'test' && !usingEmulator();
}

/** Test helper — inject a mock `verifyIdToken`. */
export function _setVerifyIdTokenForTests(fn: VerifyIdTokenFn | null): void {
  verifyOverride = fn;
}

export function _resetFirebaseAuthForTests(): void {
  verifyOverride = null;
  app = null;
}

/**
 * Ensure Firebase Admin app is initialized (shared with Firestore when already booted).
 */
export function ensureFirebaseApp(): App {
  if (app) return app;
  const existing = getApps()[0];
  if (existing) {
    app = existing;
    return app;
  }

  if (authAdminUnavailableInTests()) {
    throw new Error(
      'Firebase Auth Admin is unavailable in tests without FIRESTORE_EMULATOR_HOST; mock verifyIdToken',
    );
  }

  if (usingEmulator()) {
    app = initializeApp({ projectId: env.FIREBASE_PROJECT_ID });
  } else {
    app = initializeApp({
      credential: cert({
        projectId: env.FIREBASE_PROJECT_ID,
        clientEmail: env.FIREBASE_CLIENT_EMAIL,
        privateKey: env.FIREBASE_PRIVATE_KEY,
      }),
    });
  }
  return app;
}

export function mapDecodedTokenToAuthUser(decoded: DecodedIdToken): AuthUser {
  const claims = decoded as DecodedIdToken & { picture?: unknown; photoURL?: unknown };
  const picture =
    typeof claims.picture === 'string'
      ? claims.picture
      : typeof claims.photoURL === 'string'
        ? claims.photoURL
        : null;

  return {
    uid: decoded.uid,
    email: decoded.email ?? null,
    name: typeof decoded.name === 'string' ? decoded.name : null,
    picture,
  };
}

/**
 * Verify a Firebase ID token and return domain AuthUser.
 * Never trusts body fields — claims come only from the verified token.
 */
export async function verifyFirebaseIdToken(token: string): Promise<AuthUser> {
  try {
    const decoded = verifyOverride
      ? await verifyOverride(token)
      : await getAuth(ensureFirebaseApp()).verifyIdToken(token);
    return mapDecodedTokenToAuthUser(decoded);
  } catch (err) {
    logger.debug({ err }, 'Firebase ID token verification failed');
    throw err;
  }
}
