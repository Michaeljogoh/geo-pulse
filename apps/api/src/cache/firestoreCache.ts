import { Timestamp } from 'firebase-admin/firestore';

import { COLLECTIONS } from '../lib/collections.js';
import { getDb, initFirestore, isFirestoreInitialized } from '../lib/firestore.js';
import { hashKey } from '../lib/hash.js';
import { logger } from '../lib/logger.js';
import type { CacheDocument } from '../types/firestore.js';
import type { CacheHit, CacheSetMeta, CacheStore } from './types.js';

/**
 * L2 Firestore cache — `cache/{sha256(logicalKey)}` (Section 10).
 * Fail-open on any error so cache never breaks the request path.
 */
export class FirestoreCache implements CacheStore {
  private available: boolean | null;

  constructor(options?: { available?: boolean }) {
    this.available = options?.available ?? null;
  }

  private ensureAvailable(): boolean {
    if (this.available === false) return false;
    if (this.available === true) return true;
    try {
      initFirestore();
      this.available = true;
      return true;
    } catch {
      this.available = false;
      return false;
    }
  }

  private docRef(logicalKey: string) {
    return getDb().collection(COLLECTIONS.CACHE).doc(hashKey(logicalKey));
  }

  async get<T>(key: string): Promise<CacheHit<T> | null> {
    if (!this.ensureAvailable()) return null;
    try {
      const snap = await this.docRef(key).get();
      if (!snap.exists) return null;
      const data = snap.data() as CacheDocument | undefined;
      if (!data?.expiresAt) return null;

      const expiresAtMs = data.expiresAt.toMillis();
      if (expiresAtMs <= Date.now()) {
        return null;
      }

      return {
        value: data.payload as T,
        expiresAt: expiresAtMs,
        source: data.source,
      };
    } catch (err) {
      logger.warn({ err, key }, 'firestore cache get failed (fail-open)');
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlS: number, meta: CacheSetMeta): Promise<void> {
    if (!this.ensureAvailable()) return;
    try {
      const now = Timestamp.now();
      const expiresAt = Timestamp.fromMillis(now.toMillis() + ttlS * 1000);
      const doc: CacheDocument = {
        key,
        payload: value,
        source: meta.source,
        createdAt: now,
        expiresAt,
        ttlSeconds: ttlS,
      };
      await this.docRef(key).set(doc);
    } catch (err) {
      logger.warn({ err, key }, 'firestore cache set failed (fail-open)');
    }
  }

  /** Peek including expired entries for stale-while-error. */
  async getIncludingExpired<T>(key: string): Promise<CacheHit<T> | null> {
    if (!this.ensureAvailable()) return null;
    try {
      const snap = await this.docRef(key).get();
      if (!snap.exists) return null;
      const data = snap.data() as CacheDocument | undefined;
      if (!data?.expiresAt) return null;
      return {
        value: data.payload as T,
        expiresAt: data.expiresAt.toMillis(),
        source: data.source,
      };
    } catch (err) {
      logger.warn({ err, key }, 'firestore cache getIncludingExpired failed (fail-open)');
      return null;
    }
  }
}

export function createFirestoreCache(): FirestoreCache {
  return new FirestoreCache(
    isFirestoreInitialized() ? { available: true } : undefined,
  );
}
