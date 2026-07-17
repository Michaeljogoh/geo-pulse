# ADR 0005: Firebase Authentication ID-token verification

## Status

Accepted

## Context

Protected routes (`/api/me`, watchlist) need a trusted caller identity. API clients typically use
the Firebase client SDK (Google / email-password). Introducing a separate JWT issuer or session
store would duplicate identity and add another secret to operate.

## Decision

- Clients send `Authorization: Bearer <Firebase ID token>`.
- The API verifies tokens with Firebase Admin `verifyIdToken` (same Admin app as Firestore).
- `AuthUser` (`uid`, `email`, `name`, `picture`) is taken **only** from verified token claims —
  never from the request body.
- `AUTH_ENABLED=false` injects a fixed local user for development only; it is rejected when
  `NODE_ENV=production`.
- Tests inject a mock verifier (`_setVerifyIdTokenForTests`) so CI does not need live Firebase Auth.

## Consequences

- Single identity provider shared with API clients.
- Token expiry / revocation follows Firebase Auth rules.
- Multi-tenant or custom claims can be added later without changing the Bearer transport.
