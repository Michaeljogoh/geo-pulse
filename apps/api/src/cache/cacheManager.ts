import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { FirestoreCache } from './firestoreCache.js';
import { MemoryCache } from './memoryCache.js';
import type {
  CacheHit,
  CacheProducerError,
  CacheResult,
  CacheStore,
} from './types.js';

export interface CacheManagerOptions {
  l1?: MemoryCache;
  l2?: CacheStore & { getIncludingExpired?<T>(key: string): Promise<CacheHit<T> | null> };
  cacheEnabled?: boolean;
  now?: () => number;
}

function isRetryableUpstream(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as CacheProducerError;
  return e.retryable === true || e.isUpstream === true;
}

export class CacheManager {
  private readonly l1: MemoryCache;
  private readonly l2: CacheStore & {
    getIncludingExpired?<T>(key: string): Promise<CacheHit<T> | null>;
  };
  private readonly cacheEnabled: boolean;

  constructor(options: CacheManagerOptions = {}) {
    this.l1 = options.l1 ?? new MemoryCache();
    this.l2 = options.l2 ?? new FirestoreCache();
    this.cacheEnabled = options.cacheEnabled ?? env.CACHE_ENABLED;
  }

  getL1Stats(): { l1Keys: number; hitRatio: number; hits: number; misses: number } {
    return this.l1.getStats();
  }

  /** Test helper — clears L1 so producer paths can be exercised again. */
  _flushL1ForTests(): void {
    this.l1.flush();
  }

  async getOrSet<T>(
    logicalKey: string,
    ttlS: number,
    producer: () => Promise<T>,
  ): Promise<CacheResult<T>> {
    if (!this.cacheEnabled) {
      const value = await producer();
      return { value, source: 'live' };
    }

    const l1Hit = await this.l1.get<T>(logicalKey);
    if (l1Hit) {
      return { value: l1Hit.value, source: 'cache-l1' };
    }

    const l2Hit = await this.l2.get<T>(logicalKey);
    if (l2Hit) {
      await this.l1.set(logicalKey, l2Hit.value, ttlS, { source: l2Hit.source });
      return { value: l2Hit.value, source: 'cache-l2' };
    }

    try {
      const value = await producer();
      await Promise.all([
        this.l1.set(logicalKey, value, ttlS, { source: 'live' }),
        this.l2.set(logicalKey, value, ttlS, { source: 'live' }),
      ]);
      return { value, source: 'live' };
    } catch (err) {
      if (isRetryableUpstream(err) && typeof this.l2.getIncludingExpired === 'function') {
        const stale = await this.l2.getIncludingExpired<T>(logicalKey);
        if (stale) {
          logger.warn(
            { key: logicalKey, err },
            'producer failed; serving stale L2 cache (fallback)',
          );
          await this.l1.set(logicalKey, stale.value, ttlS, { source: 'fallback' });
          return { value: stale.value, source: 'fallback' };
        }
      }
      throw err;
    }
  }
}

export const cacheManager = new CacheManager();
