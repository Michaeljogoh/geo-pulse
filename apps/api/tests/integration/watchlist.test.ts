import type { DecodedIdToken } from 'firebase-admin/auth';
import { http, HttpResponse } from 'msw';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WATCHLIST_MAX_ITEMS } from '../../src/config/constants.js';
import {
  _resetFirebaseAuthForTests,
  _setVerifyIdTokenForTests,
} from '../../src/lib/firebaseAuth.js';
import { _resetCircuitBreakersForTests } from '../../src/lib/breakerRegistry.js';
import { cacheManager } from '../../src/cache/cacheManager.js';
import { makeMarketCoin } from '../msw/handlers.js';
import { server } from '../msw/server.js';

type Entry = { coinId: string; addedAt: string };

const stores = new Map<string, Entry[]>();

vi.mock('../../src/repositories/watchlistRepository.js', () => ({
  getWatchlist: async (uid: string): Promise<Entry[]> => stores.get(uid) ?? [],
  addCoin: async (uid: string, coinId: string): Promise<Entry[]> => {
    const existing = stores.get(uid) ?? [];
    if (existing.some((c) => c.coinId === coinId)) {
      return existing;
    }
    if (existing.length >= WATCHLIST_MAX_ITEMS) {
      const { AppError } = await import('../../src/lib/errors.js');
      throw AppError.validation(
        { max: WATCHLIST_MAX_ITEMS },
        `Watchlist is capped at ${WATCHLIST_MAX_ITEMS} coins`,
      );
    }
    const next = [...existing, { coinId, addedAt: new Date().toISOString() }];
    stores.set(uid, next);
    return next;
  },
  removeCoin: async (uid: string, coinId: string): Promise<Entry[]> => {
    const next = (stores.get(uid) ?? []).filter((c) => c.coinId !== coinId);
    stores.set(uid, next);
    return next;
  },
}));

import { createApp } from '../../src/app.js';

const VALID_TOKEN = 'watchlist-valid-token';
const UID = 'watchlist-user-1';

afterEach(() => {
  _resetCircuitBreakersForTests();
  cacheManager._flushL1ForTests();
  stores.clear();
  _resetFirebaseAuthForTests();
});

function mockAuth(): void {
  _setVerifyIdTokenForTests(async (token) => {
    if (token !== VALID_TOKEN) {
      throw new Error('invalid token');
    }
    return {
      uid: UID,
      email: 'wl@example.com',
      name: 'Watchlist User',
      picture: null,
      aud: 'test',
      auth_time: 1,
      exp: 9_999_999_999,
      firebase: { identities: {}, sign_in_provider: 'password' },
      iat: 1,
      iss: 'https://securetoken.google.com/test',
      sub: UID,
    } as DecodedIdToken;
  });
}

function useCoinGeckoByIds(): void {
  server.use(
    http.get('https://api.coingecko.com/api/v3/coins/markets', ({ request: req }) => {
      const url = new URL(req.url);
      const idsParam = url.searchParams.get('ids');
      const vs = url.searchParams.get('vs_currency') ?? 'usd';
      if (!idsParam) {
        return HttpResponse.json([]);
      }
      const ids = idsParam.split(',');
      const known: Record<string, ReturnType<typeof makeMarketCoin>> = {
        bitcoin: makeMarketCoin({
          id: 'bitcoin',
          symbol: 'btc',
          name: 'Bitcoin',
          current_price: vs === 'eur' ? 55000 : 60000,
        }),
        ethereum: makeMarketCoin({
          id: 'ethereum',
          symbol: 'eth',
          name: 'Ethereum',
          current_price: 3000,
        }),
      };
      return HttpResponse.json(ids.map((id) => known[id]).filter(Boolean));
    }),
  );
}

describe('GET/PUT/DELETE /api/watchlist', () => {
  const app = createApp();

  beforeEach(() => {
    mockAuth();
    useCoinGeckoByIds();
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await request(app).get('/api/watchlist');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('rejects invalid coinId with VALIDATION_ERROR', async () => {
    const res = await request(app)
      .put('/api/watchlist/NOT_VALID')
      .set('Authorization', `Bearer ${VALID_TOKEN}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('adds, lists, and removes coins with enrichment', async () => {
    const auth = { Authorization: `Bearer ${VALID_TOKEN}` };

    const empty = await request(app).get('/api/watchlist').set(auth).query({ vs: 'usd' });
    expect(empty.status).toBe(200);
    expect(empty.body.data).toEqual([]);

    const added = await request(app).put('/api/watchlist/bitcoin').set(auth).query({ vs: 'usd' });
    expect(added.status).toBe(200);
    expect(added.body.data).toHaveLength(1);
    expect(added.body.data[0]).toMatchObject({
      coinId: 'bitcoin',
      available: true,
      coin: expect.objectContaining({
        id: 'bitcoin',
        currency: 'usd',
        currentPrice: 60000,
      }),
    });

    // Idempotent add
    const again = await request(app).put('/api/watchlist/bitcoin').set(auth);
    expect(again.body.data).toHaveLength(1);

    await request(app).put('/api/watchlist/ethereum').set(auth).query({ vs: 'eur' });
    const list = await request(app).get('/api/watchlist').set(auth).query({ vs: 'eur' });
    expect(list.body.data).toHaveLength(2);
    expect(list.body.data.find((i: { coinId: string }) => i.coinId === 'bitcoin')?.coin?.currency).toBe(
      'eur',
    );

    const removed = await request(app).delete('/api/watchlist/bitcoin').set(auth);
    expect(removed.status).toBe(200);
    expect(removed.body.data.map((i: { coinId: string }) => i.coinId)).toEqual(['ethereum']);
  });

  it('marks unknown coin ids as available:false', async () => {
    const auth = { Authorization: `Bearer ${VALID_TOKEN}` };
    await request(app).put('/api/watchlist/not-a-real-coin').set(auth);

    const list = await request(app).get('/api/watchlist').set(auth);
    expect(list.status).toBe(200);
    expect(list.body.data[0]).toMatchObject({
      coinId: 'not-a-real-coin',
      available: false,
      coin: null,
    });
  });

  it('enforces the 50-coin cap', async () => {
    const auth = { Authorization: `Bearer ${VALID_TOKEN}` };
    stores.set(
      UID,
      Array.from({ length: WATCHLIST_MAX_ITEMS }, (_, i) => ({
        coinId: `coin-${i}`,
        addedAt: new Date().toISOString(),
      })),
    );

    const res = await request(app).put('/api/watchlist/overflow-coin').set(auth);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
