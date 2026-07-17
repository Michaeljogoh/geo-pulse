import { cert, deleteApp, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

import { env } from '../config/env.js';
import { COLLECTIONS } from './collections.js';
import { logger } from './logger.js';

export type FirestoreHealth = 'up' | 'down' | 'unknown';

const state: {
  app: App | null;
  db: Firestore | null;
  initAttempted: boolean;
  initError: Error | null;
} = {
  app: null,
  db: null,
  initAttempted: false,
  initError: null,
};

export function usingFirestoreEmulator(): boolean {
  return Boolean(process.env.FIRESTORE_EMULATOR_HOST);
}

/**
 * In unit/integration tests without an emulator, skip remote Firestore so
 * fail-open paths stay fast (no GCP metadata / network hangs).
 */
export function isFirestoreDisabledForTests(): boolean {
  return env.NODE_ENV === 'test' && !usingFirestoreEmulator();
}

/**
 * Lazy-init Firebase Admin + Firestore singleton.
 * Safe to call multiple times (double-init guarded).
 */
export function initFirestore(): Firestore {
  if (state.db) {
    return state.db;
  }

  if (isFirestoreDisabledForTests()) {
    state.initAttempted = true;
    const err = new Error('Firestore disabled in test without FIRESTORE_EMULATOR_HOST');
    state.initError = err;
    throw err;
  }

  state.initAttempted = true;

  try {
    if (getApps().length === 0) {
      if (usingFirestoreEmulator()) {
        // Emulator does not need a real service-account private key.
        state.app = initializeApp({ projectId: env.FIREBASE_PROJECT_ID });
      } else {
        state.app = initializeApp({
          credential: cert({
            projectId: env.FIREBASE_PROJECT_ID,
            clientEmail: env.FIREBASE_CLIENT_EMAIL,
            privateKey: env.FIREBASE_PRIVATE_KEY,
          }),
        });
      }
    } else {
      state.app = getApps()[0] ?? null;
    }

    state.db = getFirestore();
    state.initError = null;
    logger.info(
      {
        projectId: env.FIREBASE_PROJECT_ID,
        emulator: usingFirestoreEmulator(),
      },
      'firestore initialized',
    );
    return state.db;
  } catch (err) {
    state.initError = err instanceof Error ? err : new Error(String(err));
    logger.warn({ err: state.initError }, 'firestore init failed');
    throw state.initError;
  }
}

/** Returns the Firestore singleton, initializing on first use. */
export function getDb(): Firestore {
  return initFirestore();
}

/**
 * Plan Spec singleton — lazy Proxy so `import { db }` always resolves the same instance.
 * Prefer `getDb()` in new code; `db` is a lazy proxy for convenience.
 */
export const db: Firestore = new Proxy({} as Firestore, {
  get(_target, prop, _receiver) {
    const real = getDb();
    const value = Reflect.get(real, prop, real) as unknown;
    return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(real) : value;
  },
});

export function isFirestoreInitialized(): boolean {
  return state.db !== null;
}

/**
 * Cheap health probe for GET /health.
 * Must never throw; reports up | down | unknown.
 */
export async function checkFirestoreHealth(): Promise<FirestoreHealth> {
  if (isFirestoreDisabledForTests()) {
    return 'unknown';
  }

  try {
    const firestore = initFirestore();
    const ref = firestore.collection(COLLECTIONS.META).doc('health');
    await Promise.race([
      ref.get(),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('firestore health timeout')), 2000);
      }),
    ]);
    return 'up';
  } catch (err) {
    if (!state.initAttempted) {
      return 'unknown';
    }
    logger.warn({ err }, 'firestore health check failed');
    return 'down';
  }
}

/** Test helper — reset singleton between emulator test runs. */
export async function _resetFirestoreForTests(): Promise<void> {
  const apps = getApps();
  await Promise.all(apps.map((app) => deleteApp(app)));
  state.app = null;
  state.db = null;
  state.initAttempted = false;
  state.initError = null;
}
