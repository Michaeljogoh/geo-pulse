# ADR 0004: Provider abstraction (interfaces + factories)

## Status

Accepted

## Context

The API depends on multiple external vendors (IP intelligence, market data, news).
Concrete SDKs and HTTP shapes differ; calling them directly from services couples business
logic to vendors and blocks fallbacks, swaps (e.g. IP-Meta), and unit tests.

## Decision

- Define provider **interfaces** in `apps/api/src/providers/types.ts`
  (`IpIntelligenceProvider`, `MarketProvider`, `NewsProvider`).
- Implement one class per vendor under `providers/{ip,market,news}/`.
- Expose **factories** (`getIpProvider`, `getMarketProvider`, news orchestration) so services
  depend on abstractions, not concrete clients.
- Wrap calls with `withResilience` (circuit breaker + timing) at the orchestration boundary.
- Map every upstream payload through Zod + Section 12 tables into domain types.

## Consequences

- Swapping IP-Meta (or another vendor) is an env + factory change once the stub is implemented.
- Tests mock interfaces / MSW HTTP without rewriting services.
- Slight indirection cost; acceptable for maintainability and DoD Phase 7–9 design.
