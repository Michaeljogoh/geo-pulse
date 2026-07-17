# Firestore setup

## Project

1. Create a Firebase project (Native Firestore mode).
2. Create a service account with Cloud Datastore User (or Firebase Admin) role.
3. Download the JSON key; map into `apps/api/.env`:

| Env | Source |
|-----|--------|
| `FIREBASE_PROJECT_ID` | `project_id` |
| `FIREBASE_CLIENT_EMAIL` | `client_email` |
| `FIREBASE_PRIVATE_KEY` | `private_key` (keep `\n` escaped in `.env`) |

## TTL on cache

Configure a Firestore **TTL policy** on collection `cache`, field `expiresAt`, so L2 entries
auto-expire. Console: Firestore → Data → TTL.

## Emulator

Port **8085** (see `firebase.json`) so it does not clash with API `PORT=8080`.

```bash
# From repo root — requires Java
npm --prefix apps/api run test:firestore
```

## Collections (Section 10)

`cache`, `request_logs`, `provider_health`, `users`, `watchlists`, `_meta`.

Indexes: `firestore.indexes.json` includes `request_logs` ordered by `createdAt` for prune.
Deploy with `firebase deploy --only firestore:indexes`.
