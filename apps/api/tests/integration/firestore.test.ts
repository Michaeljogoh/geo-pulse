import { describe, expect, it } from 'vitest';

import { FirestoreCache } from '../../src/cache/firestoreCache.js';
import { createRequestLog } from '../../src/repositories/requestLogRepository.js';
import { upsertProviderHealth } from '../../src/repositories/providerHealthRepository.js';
import { upsertOnLogin } from '../../src/repositories/userRepository.js';

/**
 * Without FIRESTORE_EMULATOR_HOST, Firestore ops must fail-open (never throw to callers).
 * Full round-trip tests run when the emulator is available (see docs/setup/firestore.md).
 */
describe('Firestore fail-open (no emulator)', () => {
  it('FirestoreCache get/set do not throw', async () => {
    const cache = new FirestoreCache();
    await expect(cache.set('geo:8.8.8.8', { ok: true }, 60, { source: 'live' })).resolves.toBeUndefined();
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

describe.runIf(Boolean(process.env.FIRESTORE_EMULATOR_HOST))(
  'Firestore emulator round-trip',
  () => {
    it('writes and reads a cache document', async () => {
      const cache = new FirestoreCache({ available: true });
      const key = `test:cache:${Date.now()}`;
      await cache.set(key, { hello: 'world' }, 120, { source: 'live' });
      const hit = await cache.get<{ hello: string }>(key);
      expect(hit?.value).toEqual({ hello: 'world' });
      expect(hit?.source).toBe('live');
    });
  },
);
