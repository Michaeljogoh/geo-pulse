# ADR 0006: Cloud Functions for scheduled maintenance

## Status

Accepted

## Context

The API benefits from a warm L2 Firestore cache ("speed is a feature") and bounded
`request_logs` growth. Running cron inside the Express process couples maintenance to
API instance count and complicates local/dev. A separate Firebase Functions codebase
avoids importing `apps/api` (no shared build graph).

## Decision

- Package `apps/functions` uses **firebase-functions v2** + **firebase-admin** only.
- `warmCache` (`every 5 minutes`): HTTP GET hot API routes via `API_BASE_URL`.
- `pruneRequestLogs` (`every 24 hours`): delete `request_logs` older than
  `LOG_RETENTION_DAYS` in batches ≤ 500.
- Deploy with `firebase deploy --only functions` (not Docker).

## Consequences

- Cache warming requires a publicly reachable API URL and correct CORS/rate-limit headroom.
- Functions and API versions can drift; keep warm paths aligned with Section 9 contracts.
- Emulator DoD needs Java; unit tests cover config + warm HTTP outcomes without the emulator.
