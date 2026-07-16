import { describe, expect, it } from 'vitest';

import { COLLECTIONS, PROVIDER_IDS } from '../../src/lib/collections.js';
import { hashKey } from '../../src/lib/hash.js';
import type {
  CacheDocument,
  ProviderHealthDocument,
  RequestLogDocument,
  UserDocument,
  WatchlistDocument,
} from '../../src/types/firestore.js';

describe('Firestore data model (Section 10)', () => {
  it('defines the expected collection names', () => {
    expect(COLLECTIONS).toEqual({
      CACHE: 'cache',
      REQUEST_LOGS: 'request_logs',
      PROVIDER_HEALTH: 'provider_health',
      USERS: 'users',
      WATCHLISTS: 'watchlists',
      META: '_meta',
    });
  });

  it('lists provider_health document ids', () => {
    expect([...PROVIDER_IDS].sort()).toEqual(
      ['coingecko', 'cryptopanic', 'gnews', 'ipapi', 'ipwho'].sort(),
    );
  });

  it('uses SHA-256 hex for cache document ids', () => {
    const id = hashKey('market:usd:20');
    expect(id).toMatch(/^[a-f0-9]{64}$/);
  });

  it('types cover cache document fields', () => {
    const doc = {
      key: 'market:usd:20',
      payload: [{ id: 'bitcoin' }],
      source: 'live',
      createdAt: { toDate: () => new Date(), toMillis: () => Date.now() },
      expiresAt: { toDate: () => new Date(), toMillis: () => Date.now() + 60_000 },
      ttlSeconds: 60,
    } satisfies CacheDocument;
    expect(doc.key).toBe('market:usd:20');
  });

  it('types cover request_logs, provider_health, users, watchlists', () => {
    const log = {
      requestId: 'r1',
      method: 'GET',
      path: '/api/geo',
      statusCode: 200,
      ip: '8.8.8.8',
      country: 'US',
      provider: 'ipapi',
      cacheStatus: 'miss',
      latencyMs: 12,
      degraded: false,
      userAgent: null,
      createdAt: { toDate: () => new Date(), toMillis: () => Date.now() },
    } satisfies RequestLogDocument;

    const health = {
      provider: 'ipapi',
      state: 'closed',
      lastSuccessAt: null,
      lastFailureAt: null,
      consecutiveFail: 0,
      successCount: 1,
      failureCount: 0,
      avgLatencyMs: 40,
      updatedAt: { toDate: () => new Date(), toMillis: () => Date.now() },
    } satisfies ProviderHealthDocument;

    const user = {
      uid: 'u1',
      email: 'a@b.c',
      name: 'Ada',
      picture: null,
      createdAt: { toDate: () => new Date(), toMillis: () => Date.now() },
      lastLoginAt: { toDate: () => new Date(), toMillis: () => Date.now() },
    } satisfies UserDocument;

    const watchlist = {
      uid: 'u1',
      coins: [
        {
          coinId: 'bitcoin',
          addedAt: { toDate: () => new Date(), toMillis: () => Date.now() },
        },
      ],
      updatedAt: { toDate: () => new Date(), toMillis: () => Date.now() },
    } satisfies WatchlistDocument;

    expect(log.cacheStatus).toBe('miss');
    expect(health.provider).toBe('ipapi');
    expect(user.uid).toBe('u1');
    expect(watchlist.coins).toHaveLength(1);
  });
});
