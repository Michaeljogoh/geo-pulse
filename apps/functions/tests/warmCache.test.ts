import { describe, expect, it, vi } from 'vitest';

import { runWarmCache } from '../src/warmCache';

vi.mock('axios', () => ({
  default: {
    get: vi.fn(async (url: string) => {
      if (url.includes('/api/news')) {
        return { status: 500 };
      }
      return { status: 200 };
    }),
  },
}));

describe('runWarmCache', () => {
  it('GETs each hot path and records outcomes', async () => {
    const results = await runWarmCache('https://api.example.com');
    expect(results).toHaveLength(3);
    expect(results.filter((r) => r.ok)).toHaveLength(2);
    expect(results.find((r) => r.path.includes('/news'))?.ok).toBe(false);
  });

  it('throws when API_BASE_URL is missing', async () => {
    await expect(runWarmCache('')).rejects.toThrow(/API_BASE_URL/);
  });
});
