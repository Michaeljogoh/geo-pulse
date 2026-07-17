import { describe, expect, it } from 'vitest';

import { loadConfig, WARM_CACHE_PATHS } from '../src/lib/config';

describe('functions config (Phase 16)', () => {
  it('loads defaults and strips trailing slash from API_BASE_URL', () => {
    const cfg = loadConfig({
      API_BASE_URL: 'https://api.example.com/',
      LOG_RETENTION_DAYS: '7',
    });
    expect(cfg.apiBaseUrl).toBe('https://api.example.com');
    expect(cfg.logRetentionDays).toBe(7);
    expect(cfg.pruneBatchSize).toBe(500);
  });

  it('lists the three hot warm paths', () => {
    expect(WARM_CACHE_PATHS).toEqual([
      '/api/market?vs=usd',
      '/api/trending',
      '/api/news',
    ]);
  });
});

describe('prune batch sizing', () => {
  it('caps prune batch size at 500', () => {
    const cfg = loadConfig({
      API_BASE_URL: 'https://api.example.com',
      PRUNE_BATCH_SIZE: '999',
    });
    expect(cfg.pruneBatchSize).toBe(500);
  });
});
