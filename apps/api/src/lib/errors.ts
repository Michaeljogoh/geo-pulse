import type { ErrorCode } from '../types/envelope.js';

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly httpStatus: number;
  readonly details?: unknown;
  readonly isOperational: boolean;

  constructor(
    code: ErrorCode,
    httpStatus: number,
    message: string,
    details?: unknown,
    isOperational = true,
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.httpStatus = httpStatus;
    this.details = details;
    this.isOperational = isOperational;
  }

  static validation(details?: unknown, message = 'Validation failed'): AppError {
    return new AppError('VALIDATION_ERROR', 400, message, details);
  }

  static notFound(message = 'Resource not found'): AppError {
    return new AppError('NOT_FOUND', 404, message);
  }

  static rateLimited(message = 'Too many requests'): AppError {
    return new AppError('RATE_LIMITED', 429, message);
  }

  static upstreamTimeout(message = 'Upstream request timed out', details?: unknown): AppError {
    return new AppError('UPSTREAM_TIMEOUT', 504, message, details);
  }

  static upstreamError(message = 'Upstream request failed', details?: unknown): AppError {
    return new AppError('UPSTREAM_ERROR', 502, message, details);
  }

  static circuitOpen(provider: string): AppError {
    return new AppError(
      'CIRCUIT_OPEN',
      503,
      `Circuit breaker open for provider: ${provider}`,
      { provider },
    );
  }

  static internal(message = 'Internal server error', details?: unknown): AppError {
    return new AppError('INTERNAL', 500, message, details, false);
  }
}
