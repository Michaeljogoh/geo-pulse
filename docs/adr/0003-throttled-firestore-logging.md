# ADR 0003: Throttled / fire-and-forget Firestore logging

## Status

Accepted

## Context

Every API request and every upstream provider call could write to Firestore
(`request_logs`, `provider_health`). At modest traffic that still amplifies
write cost and can add tail latency if persistence is on the critical path.

## Decision

1. **`request_logs`:** write **after** `res.on('finish')`, fire-and-forget.
   Failures are logged at `warn` and never affect the client response.
2. **`provider_health`:** upsert at most **once per provider per 10 seconds**
   from `withResilience`, also fail-open. Breaker state remains authoritative
   in-process; Firestore is for observability across restarts/instances.
3. Do **not** batch via a third-party queue in v1 — keep the surface simple
   (ADR-friendly: no new approved dependency).

## Consequences

- Request latency is independent of Firestore availability.
- High-frequency provider calls may omit intermediate health snapshots within
  the throttle window (acceptable for ops dashboards).
- Multi-instance deployments each throttle independently; docs may briefly
  diverge until the next write. Coordination is out of scope for v1.
