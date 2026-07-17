# ADR 0002: Firestore as L2 cache (over Redis)

## Status

Accepted

## Context

The API needs a shared L2 cache across instances plus persistence for request logs, provider
health, users, and watchlists. Redis would be a strong cache-only option, but would add another
managed service alongside Firebase Auth / Firestore already required for auth and user data.

## Decision

Use **Cloud Firestore** for L2 cache (`cache/{sha256}`) and all persistent collections defined in
Section 10. L1 remains in-process `node-cache`. Cache reads/writes are fail-open.

## Consequences

- One operational datastore for cache + domain data.
- Higher latency than Redis for hot keys — mitigated by L1 and scheduled cache warming (Phase 16).
- Requires a TTL policy on `cache.expiresAt` for automatic cleanup.
