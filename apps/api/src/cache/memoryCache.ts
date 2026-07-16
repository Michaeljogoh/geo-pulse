import NodeCache from 'node-cache';

import { CACHE_L1_CHECK_PERIOD_S } from '../config/constants.js';
import type { CacheHit, CacheSetMeta, CacheStore } from './types.js';

interface MemoryEntry<T> {
  value: T;
  expiresAt: number;
  source: string;
}

export class MemoryCache implements CacheStore {
  private readonly cache: NodeCache;
  private hits = 0;
  private misses = 0;

  constructor(checkPeriodS = CACHE_L1_CHECK_PERIOD_S) {
    this.cache = new NodeCache({
      stdTTL: 0,
      checkperiod: checkPeriodS,
      useClones: true,
    });
  }

  async get<T>(key: string): Promise<CacheHit<T> | null> {
    const entry = this.cache.get<MemoryEntry<T>>(key);
    if (!entry) {
      this.misses += 1;
      return null;
    }
    if (entry.expiresAt <= Date.now()) {
      this.cache.del(key);
      this.misses += 1;
      return null;
    }
    this.hits += 1;
    return {
      value: entry.value,
      expiresAt: entry.expiresAt,
      source: entry.source,
    };
  }

  async set<T>(key: string, value: T, ttlS: number, meta: CacheSetMeta): Promise<void> {
    const expiresAt = Date.now() + ttlS * 1000;
    const entry: MemoryEntry<T> = {
      value,
      expiresAt,
      source: meta.source,
    };
    this.cache.set(key, entry, ttlS);
  }

  getStats(): { l1Keys: number; hitRatio: number; hits: number; misses: number } {
    const total = this.hits + this.misses;
    return {
      l1Keys: this.cache.keys().length,
      hitRatio: total === 0 ? 0 : this.hits / total,
      hits: this.hits,
      misses: this.misses,
    };
  }
}
