import { describe, expect, it, vi } from 'vitest';

import { CacheManager } from '../../src/cache/cacheManager.js';
import { MemoryCache } from '../../src/cache/memoryCache.js';
import type { CacheHit, CacheSetMeta, CacheStore } from '../../src/cache/types.js';

class FakeL2 implements CacheStore {
  private readonly store = new Map<string, CacheHit<unknown>>();

  async get<T>(key: string): Promise<CacheHit<T> | null> {
    const hit = this.store.get(key);
    if (!hit) return null;
    if (hit.expiresAt <= Date.now()) return null;
    return hit as CacheHit<T>;
  }

  async set<T>(key: string, value: T, ttlS: number, meta: CacheSetMeta): Promise<void> {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlS * 1000,
      source: meta.source,
    });
  }

  async getIncludingExpired<T>(key: string): Promise<CacheHit<T> | null> {
    const hit = this.store.get(key);
    return (hit as CacheHit<T> | undefined) ?? null;
  }

  seedExpired<T>(key: string, value: T, source = 'live'): void {
    this.store.set(key, {
      value,
      expiresAt: Date.now() - 1_000,
      source,
    });
  }
}

describe('CacheManager', () => {
  it('returns L1 hit without calling producer', async () => {
    const l1 = new MemoryCache();
    const l2 = new FakeL2();
    const manager = new CacheManager({ l1, l2, cacheEnabled: true });
    const producer = vi.fn(async () => ({ n: 1 }));

    await l1.set('k', { n: 42 }, 60, { source: 'live' });
    const result = await manager.getOrSet('k', 60, producer);

    expect(result).toEqual({ value: { n: 42 }, source: 'cache-l1' });
    expect(producer).not.toHaveBeenCalled();
  });

  it('on L1 miss and L2 hit, populates L1 and returns cache-l2', async () => {
    const l1 = new MemoryCache();
    const l2 = new FakeL2();
    const manager = new CacheManager({ l1, l2, cacheEnabled: true });
    const producer = vi.fn(async () => ({ n: 1 }));

    await l2.set('k', { n: 7 }, 60, { source: 'live' });
    const result = await manager.getOrSet('k', 60, producer);

    expect(result).toEqual({ value: { n: 7 }, source: 'cache-l2' });
    expect(producer).not.toHaveBeenCalled();

    const l1After = await l1.get<{ n: number }>('k');
    expect(l1After?.value).toEqual({ n: 7 });
  });

  it('on full miss, calls producer once and populates both layers', async () => {
    const l1 = new MemoryCache();
    const l2 = new FakeL2();
    const manager = new CacheManager({ l1, l2, cacheEnabled: true });
    const producer = vi.fn(async () => ({ n: 99 }));

    const result = await manager.getOrSet('k', 60, producer);
    expect(result).toEqual({ value: { n: 99 }, source: 'live' });
    expect(producer).toHaveBeenCalledTimes(1);

    expect((await l1.get<{ n: number }>('k'))?.value).toEqual({ n: 99 });
    expect((await l2.get<{ n: number }>('k'))?.value).toEqual({ n: 99 });
  });

  it('stale-while-error returns expired L2 value when producer throws retryable error', async () => {
    const l1 = new MemoryCache();
    const l2 = new FakeL2();
    l2.seedExpired('k', { n: 'stale' });
    const manager = new CacheManager({ l1, l2, cacheEnabled: true });

    const err = Object.assign(new Error('upstream down'), { isUpstream: true });
    const producer = vi.fn(async () => {
      throw err;
    });

    const result = await manager.getOrSet('k', 60, producer);
    expect(result).toEqual({ value: { n: 'stale' }, source: 'fallback' });
    expect(producer).toHaveBeenCalledTimes(1);
  });

  it('bypasses cache when cacheEnabled is false', async () => {
    const l1 = new MemoryCache();
    const l2 = new FakeL2();
    await l1.set('k', { n: 1 }, 60, { source: 'live' });
    const manager = new CacheManager({ l1, l2, cacheEnabled: false });
    const producer = vi.fn(async () => ({ n: 2 }));

    const result = await manager.getOrSet('k', 60, producer);
    expect(result).toEqual({ value: { n: 2 }, source: 'live' });
    expect(producer).toHaveBeenCalledTimes(1);
  });
});
