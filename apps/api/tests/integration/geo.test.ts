import { http, HttpResponse } from 'msw';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';
import { _resetCircuitBreakersForTests } from '../../src/lib/breakerRegistry.js';
import { ipApiSuccess, ipWhoSuccess } from '../msw/handlers.js';
import { server } from '../msw/server.js';

afterEach(() => {
  _resetCircuitBreakersForTests();
});

describe('GET /api/geo', () => {
  const app = createApp();

  beforeEach(() => {
    server.use(
      http.get('http://ip-api.com/json/:ip', () => HttpResponse.json(ipApiSuccess)),
      http.get('https://ipwho.is/:ip', () => HttpResponse.json(ipWhoSuccess)),
    );
  });

  it('returns normalized IpIntelligence for 8.8.8.8', async () => {
    const res = await request(app).get('/api/geo').query({ ip: '8.8.8.8' });
    expect(res.status).toBe(200);
    expect(res.body.error).toBeNull();
    expect(res.body.data).toMatchObject({
      ip: '8.8.8.8',
      countryCode: 'US',
      networkType: 'datacenter',
    });
    expect(res.body.meta.provider).toBe('ipapi');
    expect(res.body.meta.confidence).toBeGreaterThan(0.5);
  });

  it(
    'falls back to ipwho when ip-api returns 500',
    async () => {
      server.use(
        http.get('http://ip-api.com/json/:ip', () =>
          HttpResponse.json({ error: 'fail' }, { status: 500 }),
        ),
        http.get('https://ipwho.is/:ip', () => HttpResponse.json(ipWhoSuccess)),
      );

      const res = await request(app).get('/api/geo').query({ ip: '1.1.1.1' });
      expect(res.status).toBe(200);
      expect(res.body.meta.provider).toBe('ipwho');
      expect(res.body.data.networkType).toBe('unknown');
    },
    20_000,
  );

  it('serves second identical request from L1 cache', async () => {
    const ip = '9.9.9.9';
    server.use(
      http.get('http://ip-api.com/json/:ip', () =>
        HttpResponse.json({ ...ipApiSuccess, query: ip }),
      ),
    );

    const first = await request(app).get('/api/geo').query({ ip });
    expect(first.status).toBe(200);
    expect(first.body.meta.source).toBe('live');

    const second = await request(app).get('/api/geo').query({ ip });
    expect(second.status).toBe(200);
    expect(second.body.meta.source).toBe('cache-l1');
    expect(second.body.meta.cached).toBe(true);
  });

  it('rejects invalid ip', async () => {
    const res = await request(app).get('/api/geo').query({ ip: 'nope' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
