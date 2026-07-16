import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';

describe('GET /health', () => {
  const app = createApp();

  it('returns 200 with the health shape and X-Request-Id', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'ok',
      version: '1.0.0',
      firestore: 'unknown',
    });
    expect(typeof res.body.uptimeSeconds).toBe('number');
    expect(typeof res.body.timestamp).toBe('string');
    expect(res.headers['x-request-id']).toBeTruthy();
  });

  it('returns NOT_FOUND envelope for unknown routes', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.data).toBeNull();
    expect(res.body.error).toMatchObject({ code: 'NOT_FOUND' });
    expect(res.body.meta.requestId).toBeTruthy();
    expect(res.headers['x-request-id']).toBe(res.body.meta.requestId);
  });

  it('returns VALIDATION_ERROR envelope for malformed query on test route', async () => {
    const res = await request(app).get('/api/_test/validate');
    expect(res.status).toBe(400);
    expect(res.body.data).toBeNull();
    expect(res.body.error).toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(res.body.error.details).toBeTruthy();
  });
});
