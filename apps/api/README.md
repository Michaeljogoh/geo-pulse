# GeoIP Crypto Intelligence API (`apps/api`)

Node 22 + Express + TypeScript backend for the GeoIP Crypto Intelligence platform.

## Prerequisites

- Node.js `>=22`
- Firebase project (Firestore Native mode) **or** the Firestore emulator (Phase 6)
- Java 21+ **only** when running the Firestore emulator

## Setup

```bash
cd apps/api
cp .env.example .env
# fill FIREBASE_* and CRYPTOPANIC_TOKEN at minimum
npm install
```

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Watch mode (`tsx`) |
| `npm run build` / `npm start` | Compile + run `dist` |
| `npm test` | Unit + integration (Firestore remote disabled in test unless emulator host is set) |
| `npm run test:firestore` | Phase 6 DoD — runs Firestore integration tests **inside** the emulator |
| `npm run typecheck` / `npm run lint` | CI gates |

## Firestore emulator (Phase 6)

DoD: `tests/integration/firestore.test.ts` against the **Firestore emulator**.

From the **repo root** (where `firebase.json` lives):

```bash
# Requires Java (JRE) for the emulator
npx --yes firebase-tools emulators:exec --only firestore \
  "cd apps/api && FIRESTORE_EMULATOR_HOST=127.0.0.1:8085 npm run test:firestore:inner"
```

Or from `apps/api`:

```bash
npm run test:firestore
```

Emulator port is **8085** (see `firebase.json`) so it does not clash with the API’s default `PORT=8080`.

Without the emulator, `npm test` still runs fail-open coverage (cache/repos never throw).

More detail: `docs/setup/firestore.md` (TTL policy, service account, collections).

## Health

`GET /health` returns `{ status, uptimeSeconds, version, timestamp, firestore }` where
`firestore` is `"up" | "down" | "unknown"`.
