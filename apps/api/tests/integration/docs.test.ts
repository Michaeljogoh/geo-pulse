import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';
import { loadOpenApiDocument } from '../../src/docs/swagger.js';

/** Section 9 routes that must appear in the OpenAPI paths map. */
const REQUIRED_PATHS = [
  '/health',
  '/api/geo',
  '/api/market',
  '/api/trending',
  '/api/news',
  '/api/dashboard',
  '/api/status',
  '/api/me',
  '/api/watchlist',
  '/api/watchlist/{coinId}',
] as const;

const REQUIRED_SCHEMAS = [
  'IpIntelligence',
  'Coin',
  'TrendingCoin',
  'TrendingResult',
  'NewsItem',
  'DashboardPayload',
  'SectionMeta',
  'ProviderHealth',
  'AuthUser',
  'WatchlistItem',
  'ResponseMeta',
  'ApiError',
  'ErrorCode',
] as const;

describe('OpenAPI + Swagger UI (Phase 12)', () => {
  const app = createApp();

  it('parses as OpenAPI 3.1 with required paths and domain schemas', () => {
    const doc = loadOpenApiDocument();

    expect(doc.openapi).toMatch(/^3\.1/);
    expect(doc.info).toEqual(
      expect.objectContaining({
        title: expect.any(String),
        version: '1.0.0',
      }),
    );

    const paths = doc.paths as Record<string, unknown>;
    expect(paths).toBeTruthy();

    for (const path of REQUIRED_PATHS) {
      expect(paths[path], `missing path ${path}`).toBeTruthy();
    }

    const schemas = (doc.components as { schemas?: Record<string, unknown> })?.schemas;
    expect(schemas).toBeTruthy();
    for (const name of REQUIRED_SCHEMAS) {
      expect(schemas?.[name], `missing schema ${name}`).toBeTruthy();
    }

    const securitySchemes = (doc.components as { securitySchemes?: Record<string, unknown> })
      ?.securitySchemes;
    expect(securitySchemes?.bearerAuth).toBeTruthy();
  });

  it('serves /openapi.json without envelope', async () => {
    const res = await request(app).get('/openapi.json');
    expect(res.status).toBe(200);
    expect(res.body.openapi).toMatch(/^3\.1/);
    expect(res.body.paths['/api/geo']).toBeTruthy();
    expect(res.body.data).toBeUndefined();
    expect(res.body.error).toBeUndefined();
  });

  it('serves Swagger UI at /docs', async () => {
    const res = await request(app).get('/docs/');
    expect(res.status).toBe(200);
    expect(res.text).toMatch(/swagger/i);
  });
});
