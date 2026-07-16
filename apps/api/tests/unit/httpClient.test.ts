import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { createHttpClient, type NormalizedHttpError } from '../../src/lib/httpClient.js';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('createHttpClient', () => {
  it('retries once on 500 then succeeds', async () => {
    let hits = 0;
    server.use(
      http.get('https://example.test/retry-ok', () => {
        hits += 1;
        if (hits === 1) {
          return HttpResponse.json({ error: 'fail' }, { status: 500 });
        }
        return HttpResponse.json({ ok: true });
      }),
    );

    const client = createHttpClient({ name: 'test', timeoutMs: 2000 });
    const res = await client.get('https://example.test/retry-ok');
    expect(res.data).toEqual({ ok: true });
    expect(hits).toBe(2);
  });

  it('does not retry on 400', async () => {
    let hits = 0;
    server.use(
      http.get('https://example.test/bad-request', () => {
        hits += 1;
        return HttpResponse.json({ error: 'bad' }, { status: 400 });
      }),
    );

    const client = createHttpClient({ name: 'test', timeoutMs: 2000 });
    await expect(client.get('https://example.test/bad-request')).rejects.toMatchObject({
      status: 400,
      providerName: 'test',
      isTimeout: false,
    } satisfies Partial<NormalizedHttpError>);
    expect(hits).toBe(1);
  });

  it('rejects with isTimeout=true after retries on persistent timeout', async () => {
    server.use(
      http.get('https://example.test/slow', async () => {
        await new Promise((r) => setTimeout(r, 200));
        return HttpResponse.json({ ok: true });
      }),
    );

    const client = createHttpClient({ name: 'test', timeoutMs: 50 });
    const err = (await client.get('https://example.test/slow').catch((e: unknown) => e)) as NormalizedHttpError;
    expect(err.isTimeout).toBe(true);
    expect(err.providerName).toBe('test');
  }, 20_000);
});
