import {
  CB_FAILURE_THRESHOLD,
  CB_HALF_OPEN_MAX_CALLS,
  CB_OPEN_MS,
} from '../config/constants.js';
import { CircuitBreaker } from '../lib/circuitBreaker.js';
import type { CircuitBreakerSnapshot } from '../lib/circuitBreaker.js';
import type { ProviderHealth } from '../types/domain.js';

/** Provider ids included in GET /api/status. */
export const STATUS_PROVIDER_NAMES = [
  'ipapi',
  'ipwho',
  'coingecko',
  'cryptocompare',
  'gnews',
] as const;

const breakers = new Map<string, CircuitBreaker>();

export function getCircuitBreaker(name: string): CircuitBreaker {
  let breaker = breakers.get(name);
  if (!breaker) {
    breaker = new CircuitBreaker(name, {
      failureThreshold: CB_FAILURE_THRESHOLD,
      openMs: CB_OPEN_MS,
      halfOpenMaxCalls: CB_HALF_OPEN_MAX_CALLS,
    });
    breakers.set(name, breaker);
  }
  return breaker;
}

export function listCircuitBreakerSnapshots(): CircuitBreakerSnapshot[] {
  return Array.from(breakers.values()).map((b) => b.getSnapshot());
}

function toProviderHealth(provider: string, snap: CircuitBreakerSnapshot): ProviderHealth {
  return {
    provider,
    state: snap.state,
    lastSuccessAt: snap.lastSuccessAt ? new Date(snap.lastSuccessAt).toISOString() : null,
    lastFailureAt: snap.lastFailureAt ? new Date(snap.lastFailureAt).toISOString() : null,
    consecutiveFail: snap.consecutiveFail,
    successCount: snap.successCount,
    failureCount: snap.failureCount,
    avgLatencyMs: 0,
  };
}

/**
 * In-memory circuit-breaker snapshots for known providers.
 * Timestamps may be enriched from Firestore `provider_health`.
 */
export function listProviderHealthFromBreakers(): ProviderHealth[] {
  for (const name of STATUS_PROVIDER_NAMES) {
    getCircuitBreaker(name);
  }

  return STATUS_PROVIDER_NAMES.map((provider) => {
    const breaker = getCircuitBreaker(provider);
    return toProviderHealth(provider, breaker.getSnapshot());
  });
}

/** Test helper */
export function _resetCircuitBreakersForTests(): void {
  breakers.clear();
}
