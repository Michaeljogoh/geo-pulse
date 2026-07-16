/**
 * Standard response envelope (plan Section 7).
 * Every endpoint except /health, /docs, /openapi.json returns ApiResponse<T>.
 */

/** Error taxonomy codes (plan Section 8). */
export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'UPSTREAM_TIMEOUT'
  | 'UPSTREAM_ERROR'
  | 'CIRCUIT_OPEN'
  | 'INTERNAL';

export interface ResponseMeta {
  requestId: string;
  source: 'live' | 'cache-l1' | 'cache-l2' | 'fallback';
  provider?: string;
  latencyMs: number;
  cached: boolean;
  confidence?: number | null; // present for IP intelligence
  lastUpdated?: string | null; // ISO of underlying data
  degraded?: boolean;
}

export interface ApiError {
  code: ErrorCode;
  message: string; // human-readable, safe to show
  details?: unknown; // validation issues, etc. (never secrets)
}

export interface ApiResponse<T> {
  data: T | null;
  meta: ResponseMeta;
  error: ApiError | null;
}
