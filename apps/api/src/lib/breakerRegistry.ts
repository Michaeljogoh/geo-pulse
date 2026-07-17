import {
  CB_FAILURE_THRESHOLD,
  CB_HALF_OPEN_MAX_CALLS,
  CB_OPEN_MS,
} from '../config/constants.js';
import { CircuitBreaker } from '../lib/circuitBreaker.js';
import type { CircuitBreakerSnapshot } from '../lib/circuitBreaker.js';
import type { ProviderHealth } from '../types/domain.js';

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

export function listProviderHealthFromBreakers(): ProviderHealth[] {
  return Array.from(breakers.entries()).map(([provider, breaker]) => {
    const snap = breaker.getSnapshot();
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
  });
}

/** Test helper */
export function _resetCircuitBreakersForTests(): void {
  breakers.clear();
}
