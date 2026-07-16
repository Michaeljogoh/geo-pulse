import type { Timestamp } from 'firebase-admin/firestore';

/**
 * Section 10 — Firestore document shapes (Native mode).
 * Timestamps are stored as Firestore Timestamp; ISO strings used at the API boundary.
 */

export type CacheStatus = 'hit-l1' | 'hit-l2' | 'miss' | 'n/a';

export type ProviderHealthState = 'closed' | 'open' | 'half_open';

/** `cache/{cacheKey}` — cacheKey = SHA-256 hex of the logical key. */
export interface CacheDocument {
  key: string;
  payload: unknown;
  source: string;
  createdAt: Timestamp;
  expiresAt: Timestamp;
  ttlSeconds: number;
}

/** `request_logs/{autoId}` */
export interface RequestLogDocument {
  requestId: string;
  method: string;
  path: string;
  statusCode: number;
  ip: string | null;
  country: string | null;
  provider: string | null;
  cacheStatus: CacheStatus;
  latencyMs: number;
  degraded: boolean;
  userAgent: string | null;
  createdAt: Timestamp;
}

/** Input for creating a request log (timestamps applied by repository). */
export type RequestLogInput = Omit<RequestLogDocument, 'createdAt'>;

/** `provider_health/{provider}` */
export interface ProviderHealthDocument {
  provider: string;
  state: ProviderHealthState;
  lastSuccessAt: Timestamp | null;
  lastFailureAt: Timestamp | null;
  consecutiveFail: number;
  successCount: number;
  failureCount: number;
  avgLatencyMs: number;
  updatedAt: Timestamp;
}

export type ProviderHealthInput = {
  provider: string;
  state: ProviderHealthState;
  lastSuccessAt: Date | null;
  lastFailureAt: Date | null;
  consecutiveFail: number;
  successCount: number;
  failureCount: number;
  avgLatencyMs: number;
};

/** `users/{uid}` */
export interface UserDocument {
  uid: string;
  email: string | null;
  name: string | null;
  picture: string | null;
  createdAt: Timestamp;
  lastLoginAt: Timestamp;
}

/** `watchlists/{uid}` */
export interface WatchlistCoinEntry {
  coinId: string;
  addedAt: Timestamp;
}

export interface WatchlistDocument {
  uid: string;
  coins: WatchlistCoinEntry[];
  updatedAt: Timestamp;
}
