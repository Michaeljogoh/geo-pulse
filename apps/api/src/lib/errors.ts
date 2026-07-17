import type { ApiError, ErrorCode } from '../types/envelope.js';

/** Single source of truth: ErrorCode → HTTP status (plan Section 8). */
export const ERROR_HTTP_STATUS = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  RATE_LIMITED: 429,
  UPSTREAM_ERROR: 502,
  CIRCUIT_OPEN: 503,
  UPSTREAM_TIMEOUT: 504,
  INTERNAL: 500,
} as const satisfies Record<ErrorCode, number>;

/**
 * Operational application error.
 * Carries `{ code, httpStatus, message, details?, isOperational }`.
 * Mapped to the standard envelope by `errorHandler`.
 *
 * Section 13: never reflect raw upstream error bodies to clients —
 * only client-safe codes expose `details` via `toApiError()`.
 */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly httpStatus: number;
  readonly details?: unknown;
  readonly isOperational: boolean;

  /** Codes whose `details` are safe to return in the API envelope. */
  private static readonly CLIENT_DETAILS_CODES: ReadonlySet<ErrorCode> = new Set([
    'VALIDATION_ERROR',
    'CIRCUIT_OPEN',
    'UNAUTHENTICATED',
    'FORBIDDEN',
    'NOT_FOUND',
    'RATE_LIMITED',
  ]);

  constructor(
    code: ErrorCode,
    message: string,
    details?: unknown,
    isOperational = true,
    httpStatus: number = ERROR_HTTP_STATUS[code],
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.httpStatus = httpStatus;
    this.details = details;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  toApiError(): ApiError {
    const includeDetails =
      this.details !== undefined && AppError.CLIENT_DETAILS_CODES.has(this.code);
    return {
      code: this.code,
      message: this.message,
      ...(includeDetails ? { details: this.details } : {}),
    };
  }

  /** Zod query/param validation fails → 400 */
  static validation(details?: unknown, message = 'Validation failed'): AppError {
    return new AppError('VALIDATION_ERROR', message, details);
  }

  /** Missing/invalid/expired Firebase ID token → 401 */
  static unauthenticated(message = 'Authentication required', details?: unknown): AppError {
    return new AppError('UNAUTHENTICATED', message, details);
  }

  /** Authenticated but not allowed for the resource → 403 */
  static forbidden(message = 'Forbidden', details?: unknown): AppError {
    return new AppError('FORBIDDEN', message, details);
  }

  /** Unknown route or resource → 404 */
  static notFound(message = 'Resource not found', details?: unknown): AppError {
    return new AppError('NOT_FOUND', message, details);
  }

  /** Client exceeded rate limit → 429 */
  static rateLimited(message = 'Too many requests', details?: unknown): AppError {
    return new AppError('RATE_LIMITED', message, details);
  }

  /** External API timed out (after retries) → 504 */
  static upstreamTimeout(message = 'Upstream request timed out', details?: unknown): AppError {
    return new AppError('UPSTREAM_TIMEOUT', message, details);
  }

  /** External API returned an unrecoverable error → 502 */
  static upstreamError(message = 'Upstream request failed', details?: unknown): AppError {
    return new AppError('UPSTREAM_ERROR', message, details);
  }

  /** Circuit breaker open for the required provider → 503 */
  static circuitOpen(provider: string): AppError {
    return new AppError('CIRCUIT_OPEN', `Circuit breaker open for provider: ${provider}`, {
      provider,
    });
  }

  /** Unexpected error → 500 (`isOperational: false`) */
  static internal(message = 'Internal server error', details?: unknown): AppError {
    return new AppError('INTERNAL', message, details, false);
  }
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}
