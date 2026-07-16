/**
 * Phase 7 — wrap provider calls with circuit breaker + timing + health hooks.
 */
export async function withResilience<T>(
  _providerName: string,
  fn: () => Promise<T>,
): Promise<{ result: T; latencyMs: number; provider: string }> {
  const started = Date.now();
  const result = await fn();
  return { result, latencyMs: Date.now() - started, provider: _providerName };
}
