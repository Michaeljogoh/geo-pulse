import { describe, expect, it } from 'vitest';

import { AppError, ERROR_HTTP_STATUS, isAppError } from '../../src/lib/errors.js';
import type { ErrorCode } from '../../src/types/envelope.js';

describe('AppError taxonomy', () => {
  const cases: Array<{
    code: ErrorCode;
    factory: () => AppError;
    status: number;
  }> = [
    {
      code: 'VALIDATION_ERROR',
      factory: () => AppError.validation([{ path: 'vs', issue: 'required' }]),
      status: 400,
    },
    {
      code: 'UNAUTHENTICATED',
      factory: () => AppError.unauthenticated(),
      status: 401,
    },
    {
      code: 'FORBIDDEN',
      factory: () => AppError.forbidden(),
      status: 403,
    },
    {
      code: 'NOT_FOUND',
      factory: () => AppError.notFound(),
      status: 404,
    },
    {
      code: 'RATE_LIMITED',
      factory: () => AppError.rateLimited(),
      status: 429,
    },
    {
      code: 'UPSTREAM_ERROR',
      factory: () => AppError.upstreamError(),
      status: 502,
    },
    {
      code: 'CIRCUIT_OPEN',
      factory: () => AppError.circuitOpen('ipapi'),
      status: 503,
    },
    {
      code: 'UPSTREAM_TIMEOUT',
      factory: () => AppError.upstreamTimeout(),
      status: 504,
    },
    {
      code: 'INTERNAL',
      factory: () => AppError.internal(),
      status: 500,
    },
  ];

  it.each(cases)('$code maps to HTTP $status', ({ code, factory, status }) => {
    const err = factory();
    expect(err).toBeInstanceOf(AppError);
    expect(isAppError(err)).toBe(true);
    expect(err.code).toBe(code);
    expect(err.httpStatus).toBe(status);
    expect(err.httpStatus).toBe(ERROR_HTTP_STATUS[code]);
    expect(err.isOperational).toBe(code !== 'INTERNAL');
  });

  it('toApiError includes details only for client-safe codes', () => {
    expect(AppError.notFound().toApiError()).toEqual({
      code: 'NOT_FOUND',
      message: 'Resource not found',
    });
    expect(AppError.validation([{ path: 'ip' }]).toApiError()).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      details: [{ path: 'ip' }],
    });
    // Upstream details must not reach the client envelope
    expect(
      AppError.upstreamError('Upstream request failed', {
        body: { secret: 'nope' },
        status: 500,
      }).toApiError(),
    ).toEqual({
      code: 'UPSTREAM_ERROR',
      message: 'Upstream request failed',
    });
    expect(
      AppError.upstreamTimeout('timed out', { providerName: 'ipapi' }).toApiError(),
    ).toEqual({
      code: 'UPSTREAM_TIMEOUT',
      message: 'timed out',
    });
    expect(AppError.internal('boom', { stack: 'x' }).toApiError()).toEqual({
      code: 'INTERNAL',
      message: 'boom',
    });
  });

  it('circuitOpen includes provider in details', () => {
    const err = AppError.circuitOpen('coingecko');
    expect(err.toApiError()).toMatchObject({
      code: 'CIRCUIT_OPEN',
      details: { provider: 'coingecko' },
    });
  });

  it('ERROR_HTTP_STATUS covers every ErrorCode exactly once', () => {
    const codes = Object.keys(ERROR_HTTP_STATUS).sort();
    expect(codes).toEqual(
      [
        'CIRCUIT_OPEN',
        'FORBIDDEN',
        'INTERNAL',
        'NOT_FOUND',
        'RATE_LIMITED',
        'UNAUTHENTICATED',
        'UPSTREAM_ERROR',
        'UPSTREAM_TIMEOUT',
        'VALIDATION_ERROR',
      ].sort(),
    );
  });
});
