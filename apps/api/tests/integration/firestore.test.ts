import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { FirestoreCache } from '../../src/cache/firestoreCache.js';
import { COLLECTIONS } from '../../src/lib/collections.js';
import {
  _resetFirestoreForTests,
  checkFirestoreHealth,
  getDb,
  initFirestore,
  usingFirestoreEmulator,
} from '../../src/lib/firestore.js';
import { hashKey } from '../../src/lib/hash.js';
import { createRequestLog } from '../../src/repositories/requestLogRepository.js';
import { upsertProviderHealth } from '../../src/repositories/providerHealthRepository.js';
import { upsertOnLogin } from '../../src/repositories/userRepository.js';

/**
 * Without FIRESTORE_EMULATOR_HOST, Firestore ops must fail-open (never throw to callers).
 * Full round-trip tests run when the emulator is available (see apps/api/README.md).
 */
describe('Firestore fail-open (no emulator)', () => {
  it('FirestoreCache get/set do not throw', async () => {
    const cache = new FirestoreCache();
    await expect(
      cache.set('geo:8.8.8.8', { ok: true }, 60, { source: 'live' }),
    ).resolves.toBeUndefined();
    await expect(cache.get('geo:8.8.8.8')).resolves.toBeNull();
  });

  it('repositories fail-open', async () => {
    await expect(
      createRequestLog({
        requestId: 't1',
        method: 'GET',
        path: '/health',
        statusCode: 200,
        ip: null,
        country: null,
        provider: null,
        cacheStatus: 'n/a',
        latencyMs: 1,
        degraded: false,
        userAgent: null,
      }),
    ).resolves.toBeUndefined();

    await expect(
      upsertProviderHealth({
        provider: 'ipapi',
        state: 'closed',
        lastSuccessAt: null,
        lastFailureAt: null,
        consecutiveFail: 0,
        successCount: 0,
        failureCount: 0,
        avgLatencyMs: 0,
      }),
    ).resolves.toBeUndefined();

    await expect(
      upsertOnLogin({
        uid: 'dev',
        email: null,
        name: null,
        picture: null,
      }),
    ).resolves.toBeUndefined();
  });
});

describe.runIf(usingFirestoreEmulator())('Firestore emulator round-trip', () => {
  beforeAll(async () => {
    await _resetFirestoreForTests();
    initFirestore();
  });

  afterAll(async () => {
    await _resetFirestoreForTests();
  });

  it('initializes a singleton db', () => {
    const a = getDb();
    const b = getDb();
    expect(a).toBe(b);
  });

  it('reports firestore health as up', async () => {
    expect(await checkFirestoreHealth()).toBe('up');
  });

  it('writes and reads a cache/{sha256} document', async () => {
    const cache = new FirestoreCache({ available: true });
    const key = `test:cache:${Date.now()}`;
    await cache.set(key, { hello: 'world' }, 120, { source: 'live' });

    const hit = await cache.get<{ hello: string }>(key);
    expect(hit?.value).toEqual({ hello: 'world' });
    expect(hit?.source).toBe('live');

    const snap = await getDb().collection(COLLECTIONS.CACHE).doc(hashKey(key)).get();
    expect(snap.exists).toBe(true);
    expect(snap.data()?.key).toBe(key);
    expect(snap.data()?.ttlSeconds).toBe(120);
  });

  it('treats expired cache entries as miss but getIncludingExpired returns them', async () => {
    const cache = new FirestoreCache({ available: true });
    const key = `test:stale:${Date.now()}`;
    await cache.set(key, { n: 1 }, 1, { source: 'live' });

    // Force expiry by rewriting expiresAt in the past
    const ref = getDb().collection(COLLECTIONS.CACHE).doc(hashKey(key));
    const { Timestamp } = await import('firebase-admin/firestore');
    await ref.update({ expiresAt: Timestamp.fromMillis(Date.now() - 1000) });

    expect(await cache.get(key)).toBeNull();
    const stale = await cache.getIncludingExpired<{ n: number }>(key);
    expect(stale?.value).toEqual({ n: 1 });
  });
});
