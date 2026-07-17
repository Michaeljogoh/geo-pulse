import { AppError } from '../lib/errors.js';
import { getCircuitBreaker } from '../lib/breakerRegistry.js';
import type { NormalizedHttpError } from '../lib/httpClient.js';
import { upsertProviderHealth } from '../repositories/providerHealthRepository.js';

export interface ResilienceResult<T> {
  result: T;
  latencyMs: number;
  provider: string;
}

function isNormalizedHttpError(err: unknown): err is NormalizedHttpError {
  return (
    typeof err === 'object' &&
    err !== null &&
    'isTimeout' in err &&
    'providerName' in err &&
    'status' in err
  );
}

function toAppError(err: unknown, providerName: string): AppError {
  if (err instanceof AppError) return err;
  if (isNormalizedHttpError(err)) {
    if (err.isTimeout) {
      return AppError.upstreamTimeout(`Upstream timeout: ${providerName}`, err);
    }
    return AppError.upstreamError(
      `Upstream error from ${providerName}` + (err.status ? ` (${err.status})` : ''),
      err,
    );
  }
  if (err instanceof Error) {
    return AppError.upstreamError(err.message, { provider: providerName });
  }
  return AppError.upstreamError(`Upstream error from ${providerName}`);
}

/**
 * Wrap a provider call with circuit breaker + timing.
 * Provider health persistence is fire-and-forget (fail-open).
 */
export async function withResilience<T>(
  providerName: string,
  fn: () => Promise<T>,
): Promise<ResilienceResult<T>> {
  const breaker = getCircuitBreaker(providerName);
  const started = Date.now();

  try {
    const result = await breaker.exec(fn);
    const latencyMs = Date.now() - started;
    const snap = breaker.getSnapshot();

    void upsertProviderHealth({
      provider: providerName,
      state: snap.state,
      lastSuccessAt: snap.lastSuccessAt ? new Date(snap.lastSuccessAt) : null,
      lastFailureAt: snap.lastFailureAt ? new Date(snap.lastFailureAt) : null,
      consecutiveFail: snap.consecutiveFail,
      successCount: snap.successCount,
      failureCount: snap.failureCount,
      avgLatencyMs: latencyMs,
    });

    return { result, latencyMs, provider: providerName };
  } catch (err) {
    const latencyMs = Date.now() - started;
    const snap = breaker.getSnapshot();
    const appError = toAppError(err, providerName);

    void upsertProviderHealth({
      provider: providerName,
      state: snap.state,
      lastSuccessAt: snap.lastSuccessAt ? new Date(snap.lastSuccessAt) : null,
      lastFailureAt: snap.lastFailureAt ? new Date(snap.lastFailureAt) : null,
      consecutiveFail: snap.consecutiveFail,
      successCount: snap.successCount,
      failureCount: snap.failureCount,
      avgLatencyMs: latencyMs,
    });

    throw appError;
  }
}
