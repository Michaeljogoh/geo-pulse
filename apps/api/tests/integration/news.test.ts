import { http, HttpResponse } from 'msw';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';
import { _resetCircuitBreakersForTests } from '../../src/lib/breakerRegistry.js';
import { fetchNews } from '../../src/providers/news/index.js';
import { cryptoPanicFixture, gNewsFixture } from '../msw/handlers.js';
import { server } from '../msw/server.js';

afterEach(() => {
  _resetCircuitBreakersForTests();
});

function useNewsHandlers(): void {
  server.use(
    http.get('https://cryptopanic.com/api/v1/posts/', () =>
      HttpResponse.json(cryptoPanicFixture),
    ),
    http.get('https://gnews.io/api/v4/search', () => HttpResponse.json(gNewsFixture)),
  );
}

describe('GET /api/news (Phase 9)', () => {
  const app = createApp();

  beforeEach(() => {
    useNewsHandlers();
  });

  it('returns normalized items for BTC,ETH', async () => {
    const res = await request(app).get('/api/news').query({ symbols: 'BTC,ETH' });
    expect(res.status).toBe(200);
    expect(res.body.error).toBeNull();
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0]).toMatchObject({
      title: 'Bitcoin hits new high',
      sentiment: 'positive',
    });
    expect(res.body.meta.provider).toBe('cryptopanic');
  });

  it(
    'falls back to GNews when CryptoPanic fails',
    async () => {
      server.use(
        http.get('https://cryptopanic.com/api/v1/posts/', () =>
          HttpResponse.json({ error: 'fail' }, { status: 500 }),
        ),
        http.get('https://gnews.io/api/v4/search', () => HttpResponse.json(gNewsFixture)),
      );

      const res = await request(app).get('/api/news').query({ symbols: 'BTC', country: 'us' });
      expect(res.status).toBe(200);
      expect(res.body.meta.provider).toBe('gnews');
      expect(res.body.data[0].title).toBe('Regional crypto news');
    },
    20_000,
  );

  it('serves second news request from L1 cache', async () => {
    const first = await request(app).get('/api/news').query({ symbols: 'BTC', lang: 'en' });
    expect(first.body.meta.source).toBe('live');

    const second = await request(app).get('/api/news').query({ symbols: 'BTC', lang: 'en' });
    expect(second.status).toBe(200);
    expect(second.body.meta.source).toBe('cache-l1');
  });

  it('rejects invalid country', async () => {
    const res = await request(app).get('/api/news').query({ country: 'USA' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('fetchNews without GNews', () => {
  beforeEach(() => {
    server.use(
      http.get('https://cryptopanic.com/api/v1/posts/', () =>
        HttpResponse.json({ results: [] }),
      ),
    );
  });

  it('returns empty list without crashing when GNews disabled', async () => {
    const result = await fetchNews({ symbols: ['BTC'] }, { gnewsEnabled: false });
    expect(result.items).toEqual([]);
    expect(result.provider).toBe('cryptopanic');
  });
});
