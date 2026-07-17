# Cloud Functions setup

Scheduled jobs for the GeoPulse platform (`apps/functions`).

## Prerequisites

- Node.js 22
- Firebase CLI (`npm i -g firebase-tools` or `npx firebase-tools`)
- Firebase project with Blaze plan (required for scheduled functions)
- Java 21+ only if using the Functions/Firestore emulators locally

## Install & build

```bash
cd apps/functions
cp .env.example .env   # for local reference; production uses Firebase params/env
npm install
npm run build
npm test
```

Compiled output lands in `apps/functions/lib/` (CommonJS, Firebase Functions default).

## Environment

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `API_BASE_URL` | yes (warmCache) | — | Live API origin, no trailing slash |
| `LOG_RETENTION_DAYS` | no | `14` | Age cutoff for `request_logs` prune |
| `PRUNE_BATCH_SIZE` | no | `500` | Max deletes per Firestore batch (capped at 500) |

Set production values in Google Cloud / Firebase:

```bash
firebase functions:config:set  # legacy — prefer params / Secret Manager
# Or set env in Google Cloud Console → Cloud Functions → warmCache / pruneRequestLogs
```

Recommended: define `API_BASE_URL` as a runtime environment variable on both functions.

## Schedules

| Function | Schedule | Behavior |
|----------|----------|----------|
| `warmCache` | every 5 minutes | GET `/api/market?vs=usd`, `/api/trending`, `/api/news` |
| `pruneRequestLogs` | every 24 hours | Delete `request_logs` where `createdAt < now - retention` |

## Deploy

From the **repo root** (where `firebase.json` lives):

```bash
# Build is invoked by predeploy
firebase deploy --only functions

# Indexes for prune queries
firebase deploy --only firestore:indexes
```

Confirm in Cloud Scheduler that both jobs are enabled.

## Emulator

```bash
# Requires Java
firebase emulators:start --only functions,firestore
```

Unit tests (`npm test` in `apps/functions`) do **not** require the emulator.

## Relation to the API

Functions **must not** import `apps/api/src`. They warm cache by calling the deployed HTTP API
and prune logs with the Admin SDK against the same Firebase project.
