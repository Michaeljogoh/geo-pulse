# Architecture overview — GeoIP Crypto Intelligence API

**Source of truth:** [geoip-crypto-intel-backend-plan.md](./geoip-crypto-intel-backend-plan.md) §1  
**Scope:** Backend package `apps/api` only. No application code in this stage.

## System diagram

```text
                         ┌─────────────────────────────────────────────┐
  Client (Next.js) ──▶   │   Express REST API (Node 22 + TypeScript)     │
                         │                                               │
                         │  Middleware: requestId → helmet → cors →      │
                         │  rateLimit → validate → route → errorHandler  │
                         │                                               │
                         │  Routes → Services → Providers                │
                         │                        │                      │
                         │                        ├─ CacheManager        │
                         │                        │    ├─ L1 node-cache   │
                         │                        │    └─ L2 Firestore    │
                         │                        │                       │
                         │                        ├─ HTTP client (retry)  │
                         │                        └─ Circuit breaker      │
                         │                                               │
                         │  Repositories → Firestore (logs, health)      │
                         └───────────────────────────┬───────────────────┘
                                                     │
        ┌────────────────────────┬───────────────────┼───────────────────────┐
        ▼                        ▼                    ▼                       ▼
  ip-api.com / ipwho.is     CoinGecko          CryptoPanic / GNews     Cloud Firestore
  (IP intelligence)        (market data)          (crypto news)        (cache + logs + health)
```

## Layering (Dependency Inversion)

| Layer | Depends on | Responsibility |
| ----- | ---------- | -------------- |
| **Routes** | Services | HTTP adapters, Zod query validation, response envelope |
| **Services** | Provider **interfaces**, CacheManager | Orchestration, cache keys/TTLs, domain use cases |
| **Providers** | HTTP client, circuit breaker | Call external APIs; map raw → normalized domain types |
| **Repositories** | Firestore | Persist request logs and provider health (fail-open) |
| **CacheManager** | L1 memory + L2 Firestore | Two-tier `getOrSet`, stale-while-error |

Concrete providers (ip-api, CoinGecko, CryptoPanic, etc.) implement the provider interfaces. Swapping the IP provider for IP-Meta later is a one-line factory change (`IP_PROVIDER` + factory), not a rewrite of routes or services.

## External systems

| System | Role |
| ------ | ---- |
| ip-api.com / ipwho.is | IP intelligence (primary / fallback); IP-Meta reserved stub |
| CoinGecko | Market lists, trending, gainers/losers |
| CryptoPanic / GNews | Crypto news (primary / optional regional fallback) |
| Cloud Firestore | L2 cache, request logs, provider health snapshots |

## What this stage does / does not include

**Included**

- This architecture contract checked into the repo
- Alignment with the backend implementation plan §1

**Not included (later phases)**

- Phase 0+ tooling, Express app, providers, cache, or endpoints
- Frontend (Next.js) implementation
- Approved dependency install (plan §2) or env wiring (plan §4)

## Next stage

**Phase 0 — Repository & tooling** (`apps/api` package.json, TypeScript, lint, vitest, empty boot).
