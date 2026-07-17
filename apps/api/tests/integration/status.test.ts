import { http, HttpResponse } from 'msw';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';
import { cacheManager } from '../../src/cache/cacheManager.js';
import { DEMO_PUBLIC_IP } from '../../src/config/constants.js';
import {
  STATUS_PROVIDER_NAMES,
  _resetCircuitBreakersForTests,
} from '../../src/lib/breakerRegistry.js';
import { ipProviderHandlers } from '../msw/handlers.js';
import { server } from '../msw/server.js';

afterEach(() => {
  _resetCircuitBreakersForTests();
  cacheManager._flushL1ForTests();
});

describe('GET /api/status', () => {
  const app = createApp();

  beforeEach(() => {
    server.use(...ipProviderHandlers);
  });

  it('returns known providers, cache stats, and uptime', async () => {
    const res = await request(app).get('/api/status');

    expect(res.status).toBe(200);
    expect(res.body.error).toBeNull();
    expect(res.body.meta.source).toBe('live');
    expect(res.body.meta.cached).toBe(false);

    const { data } = res.body;
    expect(data.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(data.cache).toEqual(
      expect.objectContaining({
        l1Keys: expect.any(Number),
        hitRatio: expect.any(Number),
      }),
    );

    const names = data.providers.map((p: { provider: string }) => p.provider);
    expect(names).toEqual([...STATUS_PROVIDER_NAMES]);

    for (const provider of data.providers) {
      expect(provider).toMatchObject({
        provider: expect.any(String),
        state: expect.stringMatching(/^(closed|open|half_open)$/),
        consecutiveFail: expect.any(Number),
        successCount: expect.any(Number),
        failureCount: expect.any(Number),
        avgLatencyMs: expect.any(Number),
      });
      expect(provider.lastSuccessAt === null || typeof provider.lastSuccessAt === 'string').toBe(
        true,
      );
      expect(provider.lastFailureAt === null || typeof provider.lastFailureAt === 'string').toBe(
        true,
      );
    }
  });

  it('reflects breaker success after a live geo lookup', async () => {
    const before = await request(app).get('/api/status');
    const ipapiBefore = before.body.data.providers.find(
      (p: { provider: string }) => p.provider === 'ipapi',
    );
    expect(ipapiBefore.successCount).toBe(0);

    const geo = await request(app).get('/api/geo').query({ ip: DEMO_PUBLIC_IP });
    expect(geo.status).toBe(200);
    expect(geo.body.meta.provider).toBe('ipapi');

    const after = await request(app).get('/api/status');
    const ipapiAfter = after.body.data.providers.find(
      (p: { provider: string }) => p.provider === 'ipapi',
    );
    expect(ipapiAfter.state).toBe('closed');
    expect(ipapiAfter.successCount).toBeGreaterThan(0);
    expect(ipapiAfter.lastSuccessAt).toBeTruthy();
  });

  it('reports L1 cache keys after a cached geo hit', async () => {
    await request(app).get('/api/geo').query({ ip: DEMO_PUBLIC_IP });
    await request(app).get('/api/geo').query({ ip: DEMO_PUBLIC_IP });

    const res = await request(app).get('/api/status');
    expect(res.status).toBe(200);
    expect(res.body.data.cache.l1Keys).toBeGreaterThanOrEqual(1);
    expect(res.body.data.cache.hitRatio).toBeGreaterThan(0);
  });

  it(
    'records failures on provider health after upstream errors',
    async () => {
      server.use(
        http.get('http://ip-api.com/json/:ip', () =>
          HttpResponse.json({ error: 'down' }, { status: 500 }),
        ),
        http.get('https://ipwho.is/:ip', () =>
          HttpResponse.json({ error: 'down' }, { status: 500 }),
        ),
      );

      await request(app).get('/api/geo').query({ ip: '1.1.1.1' });

      const res = await request(app).get('/api/status');
      expect(res.status).toBe(200);

      const ipapi = res.body.data.providers.find(
        (p: { provider: string }) => p.provider === 'ipapi',
      );
      expect(ipapi.failureCount).toBeGreaterThan(0);
      expect(ipapi.lastFailureAt).toBeTruthy();
    },
    20_000,
  );
});
