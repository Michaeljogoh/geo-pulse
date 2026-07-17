import { http, HttpResponse } from 'msw';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';
import { cacheManager } from '../../src/cache/cacheManager.js';
import { DEMO_PUBLIC_IP } from '../../src/config/constants.js';
import { _resetCircuitBreakersForTests } from '../../src/lib/breakerRegistry.js';
import {
  coinGeckoHandlers,
  coinGeckoMarketsFixture,
  coinGeckoTrendingFixture,
  cryptoPanicFixture,
  gNewsFixture,
  ipProviderHandlers,
} from '../msw/handlers.js';
import { server } from '../msw/server.js';

afterEach(() => {
  _resetCircuitBreakersForTests();
  cacheManager._flushL1ForTests();
});

function useHappyPathHandlers(): void {
  server.use(
    ...ipProviderHandlers,
    ...coinGeckoHandlers,
    http.get('https://cryptopanic.com/api/v1/posts/', () =>
      HttpResponse.json(cryptoPanicFixture),
    ),
    http.get('https://gnews.io/api/v4/search', () => HttpResponse.json(gNewsFixture)),
  );
}

describe('GET /api/dashboard (Phase 10)', () => {
  const app = createApp();

  beforeEach(() => {
    useHappyPathHandlers();
  });

  it('returns visitor + market/trending/news with currency from geo', async () => {
    const res = await request(app).get('/api/dashboard').query({ ip: DEMO_PUBLIC_IP });

    expect(res.status).toBe(200);
    expect(res.body.error).toBeNull();
    expect(res.body.meta.degraded).toBe(false);

    const { data } = res.body;
    expect(data.degraded).toBe(false);
    expect(data.visitor).toMatchObject({
      ip: DEMO_PUBLIC_IP,
      countryCode: 'US',
      currency: 'USD',
    });
    expect(data.market.length).toBeGreaterThan(0);
    expect(data.market.length).toBeLessThanOrEqual(20);
    expect(data.trending).toMatchObject({
      trending: expect.any(Array),
      gainers: expect.any(Array),
      losers: expect.any(Array),
    });
    expect(data.trending.trending.length).toBeGreaterThan(0);
    expect(data.news.length).toBeGreaterThan(0);
    expect(data.sections).toMatchObject({
      market: { ok: true, source: expect.stringMatching(/^(live|cache-l1|cache-l2)$/) },
      trending: { ok: true },
      news: { ok: true },
    });
    expect(typeof data.sections.market.latencyMs).toBe('number');
  });

  it(
    'returns 200 degraded when news providers fail but market/trending succeed',
    async () => {
      server.use(
        ...ipProviderHandlers,
        http.get('https://api.coingecko.com/api/v3/coins/markets', ({ request }) => {
          const url = new URL(request.url);
          const perPage = Number(url.searchParams.get('per_page') ?? '20');
          return HttpResponse.json(coinGeckoMarketsFixture.slice(0, perPage));
        }),
        http.get('https://api.coingecko.com/api/v3/search/trending', () =>
          HttpResponse.json(coinGeckoTrendingFixture),
        ),
        http.get('https://cryptopanic.com/api/v1/posts/', () =>
          HttpResponse.json({ error: 'down' }, { status: 500 }),
        ),
        http.get('https://gnews.io/api/v4/search', () =>
          HttpResponse.json({ error: 'down' }, { status: 500 }),
        ),
      );

      const res = await request(app).get('/api/dashboard').query({ ip: DEMO_PUBLIC_IP });

      expect(res.status).toBe(200);
      expect(res.body.error).toBeNull();
      expect(res.body.meta.degraded).toBe(true);

      const { data } = res.body;
      expect(data.degraded).toBe(true);
      expect(data.visitor.ip).toBe(DEMO_PUBLIC_IP);
      expect(data.visitor.currency).toBe('USD');
      expect(data.market.length).toBeGreaterThan(0);
      expect(data.trending.trending.length).toBeGreaterThan(0);
      expect(data.news).toEqual([]);
      expect(data.sections.market.ok).toBe(true);
      expect(data.sections.trending.ok).toBe(true);
      expect(data.sections.news).toMatchObject({
        ok: false,
        source: 'error',
        error: expect.any(String),
      });
    },
    20_000,
  );

  it('returns 200 with unknown visitor when geo fails (degraded)', async () => {
    server.use(
      http.get('http://ip-api.com/json/:ip', () =>
        HttpResponse.json({ status: 'fail', message: 'reserved range' }),
      ),
      http.get('https://ipwho.is/:ip', () =>
        HttpResponse.json({ success: false, message: 'Invalid IP' }),
      ),
      ...coinGeckoHandlers,
      http.get('https://cryptopanic.com/api/v1/posts/', () =>
        HttpResponse.json(cryptoPanicFixture),
      ),
      http.get('https://gnews.io/api/v4/search', () => HttpResponse.json(gNewsFixture)),
    );

    const res = await request(app).get('/api/dashboard').query({ ip: DEMO_PUBLIC_IP });

    expect(res.status).toBe(200);
    expect(res.body.data.degraded).toBe(true);
    expect(res.body.data.visitor).toMatchObject({
      ip: DEMO_PUBLIC_IP,
      countryCode: null,
      currency: null,
      networkType: 'unknown',
    });
    // Falls back to USD for market when currency unknown
    expect(res.body.data.market.length).toBeGreaterThan(0);
    expect(res.body.data.sections.market.ok).toBe(true);
  }, 20_000);
});
