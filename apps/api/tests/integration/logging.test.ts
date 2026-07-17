import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';

import { createApp } from '../../src/app.js';
import { COLLECTIONS } from '../../src/lib/collections.js';
import {
  _resetFirestoreForTests,
  getDb,
  initFirestore,
  usingFirestoreEmulator,
} from '../../src/lib/firestore.js';
import { withResilience } from '../../src/providers/withResilience.js';
import { _resetProviderHealthThrottleForTests } from '../../src/repositories/providerHealthRepository.js';
import { _resetCircuitBreakersForTests } from '../../src/lib/breakerRegistry.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('Request logging fail-open (no emulator)', () => {
  const app = createApp();

  it('completes /health quickly even when Firestore is unavailable', async () => {
    const started = Date.now();
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(Date.now() - started).toBeLessThan(3_000);
  });
});

describe.runIf(usingFirestoreEmulator())('Persistence logging (Phase 13 DoD)', () => {
  const app = createApp();

  beforeAll(async () => {
    await _resetFirestoreForTests();
    initFirestore();
    _resetProviderHealthThrottleForTests();
    _resetCircuitBreakersForTests();
  });

  afterAll(async () => {
    await _resetFirestoreForTests();
  });

  it('writes a request_logs document after an endpoint finishes', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    const requestId = res.headers['x-request-id'] as string;
    expect(requestId).toBeTruthy();

    // Fire-and-forget — brief poll until the log appears
    let found = false;
    for (let i = 0; i < 20; i += 1) {
      const snap = await getDb()
        .collection(COLLECTIONS.REQUEST_LOGS)
        .where('requestId', '==', requestId)
        .limit(1)
        .get();
      if (!snap.empty) {
        const data = snap.docs[0]!.data();
        expect(data.method).toBe('GET');
        expect(data.path).toBe('/health');
        expect(data.statusCode).toBe(200);
        expect(typeof data.latencyMs).toBe('number');
        expect(data.cacheStatus).toBe('n/a');
        found = true;
        break;
      }
      await sleep(100);
    }
    expect(found).toBe(true);
  });

  it('upserts provider_health from withResilience', async () => {
    _resetProviderHealthThrottleForTests();

    await withResilience('ipapi', async () => 'ok');

    let found = false;
    for (let i = 0; i < 20; i += 1) {
      const snap = await getDb().collection(COLLECTIONS.PROVIDER_HEALTH).doc('ipapi').get();
      if (snap.exists) {
        const data = snap.data()!;
        expect(data.provider).toBe('ipapi');
        expect(data.state).toBe('closed');
        expect(data.successCount).toBeGreaterThan(0);
        expect(typeof data.avgLatencyMs).toBe('number');
        found = true;
        break;
      }
      await sleep(100);
    }
    expect(found).toBe(true);
  });

  it('throttles provider_health writes within the window', async () => {
    _resetProviderHealthThrottleForTests();
    await withResilience('coingecko', async () => 1);
    await sleep(50);
    const first = await getDb().collection(COLLECTIONS.PROVIDER_HEALTH).doc('coingecko').get();
    expect(first.exists).toBe(true);
    const firstUpdated = first.data()!.updatedAt;

    await withResilience('coingecko', async () => 2);
    await sleep(50);
    const second = await getDb().collection(COLLECTIONS.PROVIDER_HEALTH).doc('coingecko').get();
    expect(second.data()!.updatedAt.isEqual(firstUpdated)).toBe(true);
    expect(second.data()!.successCount).toBe(first.data()!.successCount);
  });
});
