import { http, HttpResponse } from 'msw';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';
import { _resetCircuitBreakersForTests } from '../../src/lib/breakerRegistry.js';
import { coinGeckoMarketsFixture, coinGeckoTrendingFixture } from '../msw/handlers.js';
import { server } from '../msw/server.js';

afterEach(() => {
  _resetCircuitBreakersForTests();
});

function useCoinGeckoHandlers(): void {
  server.use(
    http.get('https://api.coingecko.com/api/v3/coins/markets', ({ request }) => {
      const url = new URL(request.url);
      const perPage = Number(url.searchParams.get('per_page') ?? '20');
      return HttpResponse.json(coinGeckoMarketsFixture.slice(0, perPage));
    }),
    http.get('https://api.coingecko.com/api/v3/search/trending', () =>
      HttpResponse.json(coinGeckoTrendingFixture),
    ),
  );
}

describe('GET /api/market and /api/trending (Phase 8)', () => {
  const app = createApp();

  beforeEach(() => {
    useCoinGeckoHandlers();
  });

  it('returns limited coins priced in EUR', async () => {
    const res = await request(app).get('/api/market').query({ vs: 'EUR', limit: 5 });
    expect(res.status).toBe(200);
    expect(res.body.error).toBeNull();
    expect(res.body.data).toHaveLength(5);
    expect(res.body.data[0].currency).toBe('eur');
    expect(res.body.meta.provider).toBe('coingecko');
  });

  it('returns trending, gainers, and losers', async () => {
    const res = await request(app).get('/api/trending').query({ vs: 'usd' });
    expect(res.status).toBe(200);
    expect(res.body.error).toBeNull();
    expect(res.body.data.trending.length).toBeGreaterThan(0);
    expect(res.body.data.gainers[0].id).toBe('cardano');
    expect(res.body.data.losers[0].id).toBe('ripple');
  });

  it('serves second market request from L1 cache', async () => {
    const first = await request(app).get('/api/market').query({ vs: 'usd', limit: 3 });
    expect(first.body.meta.source).toBe('live');

    const second = await request(app).get('/api/market').query({ vs: 'usd', limit: 3 });
    expect(second.status).toBe(200);
    expect(second.body.meta.source).toBe('cache-l1');
    expect(second.body.meta.cached).toBe(true);
  });

  it('rejects invalid limit', async () => {
    const res = await request(app).get('/api/market').query({ limit: 0 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it(
    'surfaces UPSTREAM_ERROR after persistent CoinGecko 429',
    async () => {
      server.use(
        http.get('https://api.coingecko.com/api/v3/coins/markets', () =>
          HttpResponse.json({ error: 'rate limited' }, { status: 429 }),
        ),
      );

      const res = await request(app).get('/api/market').query({ vs: 'usd', limit: 2 });
      expect(res.status).toBe(502);
      expect(res.body.error.code).toBe('UPSTREAM_ERROR');
    },
    20_000,
  );
});
