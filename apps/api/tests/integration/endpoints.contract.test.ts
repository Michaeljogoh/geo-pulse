import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';
import { DEMO_PUBLIC_IP } from '../../src/config/constants.js';
import { _resetCircuitBreakersForTests } from '../../src/lib/breakerRegistry.js';
import { DEV_AUTH_USER } from '../../src/middleware/auth.js';

afterEach(() => {
  _resetCircuitBreakersForTests();
});

describe('API endpoint contracts (Section 9)', () => {
  const app = createApp();

  describe('9.1 GET /health', () => {
    it('returns probe shape without envelope', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        status: 'ok',
        version: '1.0.0',
      });
      expect(['up', 'down', 'unknown']).toContain(res.body.firestore);
      expect(res.headers['x-request-id']).toBeTruthy();
    });
  });

  describe('9.2 GET /api/geo validation', () => {
    it('rejects invalid ip with VALIDATION_ERROR', async () => {
      const res = await request(app).get('/api/geo').query({ ip: 'not-an-ip' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('9.3–9.5 query validation', () => {
    it('rejects invalid market limit', async () => {
      const res = await request(app).get('/api/market').query({ limit: 0 });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects invalid country on news', async () => {
      const res = await request(app).get('/api/news').query({ country: 'USA' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('9.6 GET /api/dashboard', () => {
    it('returns 200 with visitor and section metas when upstreams are mocked', async () => {
      const res = await request(app).get('/api/dashboard').query({ ip: DEMO_PUBLIC_IP });
      expect(res.status).toBe(200);
      expect(res.body.error).toBeNull();
      expect(res.body.data.visitor.ip).toBe(DEMO_PUBLIC_IP);
      expect(res.body.data.sections).toMatchObject({
        market: expect.objectContaining({ ok: true }),
        trending: expect.objectContaining({ ok: true }),
        news: expect.objectContaining({ ok: true }),
      });
      expect(res.body.data.degraded).toBe(false);
      expect(res.body.meta.degraded).toBe(false);
    });
  });

  describe('9.7 GET /api/status', () => {
    it('returns providers, cache stats, and uptime', async () => {
      const res = await request(app).get('/api/status');
      expect(res.status).toBe(200);
      expect(res.body.error).toBeNull();
      expect(Array.isArray(res.body.data.providers)).toBe(true);
      expect(res.body.data.cache).toEqual(
        expect.objectContaining({
          l1Keys: expect.any(Number),
          hitRatio: expect.any(Number),
        }),
      );
      expect(typeof res.body.data.uptimeSeconds).toBe('number');
    });
  });

  describe('9.8 GET /docs and /openapi.json', () => {
    it('serves openapi json without envelope', async () => {
      const res = await request(app).get('/openapi.json');
      expect(res.status).toBe(200);
      expect(res.body.openapi).toMatch(/^3\.1/);
      expect(res.body.paths['/api/geo']).toBeTruthy();
    });

    it('serves swagger UI', async () => {
      const res = await request(app).get('/docs/');
      expect(res.status).toBe(200);
      expect(res.text).toMatch(/swagger/i);
    });
  });

  describe('9.9 authenticated endpoints', () => {
    it('GET /api/me returns 401 when AUTH_ENABLED and no token', async () => {
      const res = await request(app).get('/api/me');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('rejects invalid watchlist coinId with VALIDATION_ERROR when authorized via bypass', async () => {
      // With AUTH_ENABLED=true (test default), unauthenticated → 401 before param validation.
      const res = await request(app).put('/api/watchlist/NOT_VALID');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });
  });
});

describe('AUTH_ENABLED=false dev bypass', () => {
  it('documents DEV_AUTH_USER shape for local bypass', () => {
    expect(DEV_AUTH_USER.uid).toBe('dev-local-user');
    expect(DEV_AUTH_USER.email).toBe('dev@localhost');
  });
});
