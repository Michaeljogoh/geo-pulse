export type ErrorCode =
  | 'VALIDATION_ERROR'
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
  confidence?: number | null;
  lastUpdated?: string | null;
  degraded?: boolean;
}

export interface ApiError {
  code: ErrorCode;
  message: string;
  details?: unknown;
}

export interface ApiResponse<T> {
  data: T | null;
  meta: ResponseMeta;
  error: ApiError | null;
}
