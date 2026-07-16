export interface CacheHit<T> {
  value: T;
  expiresAt: number;
  source: string;
}

export interface CacheSetMeta {
  source: string;
}

export interface CacheStore {
  get<T>(key: string): Promise<CacheHit<T> | null>;
  set<T>(key: string, value: T, ttlS: number, meta: CacheSetMeta): Promise<void>;
}

export type CacheSource = 'live' | 'cache-l1' | 'cache-l2' | 'fallback';

export interface CacheResult<T> {
  value: T;
  source: CacheSource;
}

export interface CacheProducerError extends Error {
  retryable?: boolean;
  isUpstream?: boolean;
}
