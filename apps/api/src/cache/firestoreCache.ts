import { hashKey } from '../lib/hash.js';
import { logger } from '../lib/logger.js';
import type { CacheHit, CacheSetMeta, CacheStore } from './types.js';

/**
 * L2 Firestore cache.
 * Phase 5: no-op stub until Firestore Admin is wired in Phase 6.
 * Fail-open on any error so cache never breaks the request path.
 */
export class FirestoreCache implements CacheStore {
  private readonly available: boolean;

  constructor(options?: { available?: boolean }) {
    this.available = options?.available ?? false;
  }

  async get<T>(key: string): Promise<CacheHit<T> | null> {
    if (!this.available) {
      return null;
    }
    try {
      // Wired in Phase 6 — document path: cache/{hashKey(key)}
      void hashKey(key);
      return null;
    } catch (err) {
      logger.warn({ err, key }, 'firestore cache get failed (fail-open)');
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlS: number, meta: CacheSetMeta): Promise<void> {
    if (!this.available) {
      return;
    }
    try {
      void hashKey(key);
      void value;
      void ttlS;
      void meta;
    } catch (err) {
      logger.warn({ err, key }, 'firestore cache set failed (fail-open)');
    }
  }

  /**
   * Peek including expired entries for stale-while-error (Phase 6+).
   * Stub returns null until Firestore is wired.
   */
  async getIncludingExpired<T>(_key: string): Promise<CacheHit<T> | null> {
    return null;
  }
}
