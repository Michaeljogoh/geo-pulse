# ADR 0001: Hand-rolled circuit breaker

## Status

Accepted

## Context

Upstream providers (ip-api, CoinGecko, CryptoCompare, GNews) can fail or rate-limit.
We need a circuit breaker so cascading failures do not overwhelm slow or dead dependencies.
Adding a third-party breaker library would expand the approved dependency list without clear benefit for our simple per-provider state machine.

## Decision

Implement a small in-memory `CircuitBreaker` class in `src/lib/circuitBreaker.ts` with states
`closed` → `open` → `half_open`, injectable `now()` for tests, and `AppError.circuitOpen` on reject.
No external circuit-breaker library.

## Consequences

- Zero extra runtime dependencies for resilience state.
- Breaker state is process-local (not shared across instances); Phase 13 persists snapshots to Firestore for observability, not coordination.
- Behavior is fully covered by unit tests with deterministic time.
