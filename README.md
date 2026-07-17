# GeoPulse — Backend

This repository is the **GeoPulse backend only**: a Node 22 + Express + TypeScript REST API
plus Firebase Cloud Functions. There is no frontend app in this repo.

GeoPulse orchestrates IP intelligence, crypto markets, and news behind a standard
`{ data, meta, error }` envelope. Firebase Auth protects user routes; Firestore is L2 cache +
persistence; Cloud Functions warm cache and prune logs.

```text
Clients ──► apps/api (Express)
               ├─ providers (ip-api / ipwho, CoinGecko, CryptoPanic / GNews)
               ├─ L1 node-cache + L2 Firestore cache
               └─ Firestore: users, watchlists, request_logs, provider_health

         apps/functions (scheduled)
               ├─ warmCache     → HTTP GET hot API routes
               └─ pruneRequestLogs → delete old request_logs
```

## Packages

| Path | Role |
|------|------|
| `apps/api` | REST API + OpenAPI (`/docs`) |
| `apps/functions` | Firebase scheduled functions (does not import `apps/api`) |

## Prerequisites

- Node.js `>=22`
- Firebase project (Firestore Native + Authentication)
- Java 21+ only for Firestore/Functions emulators
- Docker (optional)

## Quick start (<10 minutes)

```bash
git clone <repo-url> && cd geo-pulse

cd apps/api
cp .env.example .env
# fill FIREBASE_* and CRYPTOPANIC_TOKEN at minimum
npm install
npm run dev
# → http://localhost:8080/health
# → http://localhost:8080/docs
```

Env reference: [`apps/api/.env.example`](apps/api/.env.example).

## Tests

```bash
cd apps/api
npm test
npm run test:coverage
npm run test:firestore   # needs Java
```

```bash
cd apps/functions
npm install && npm test && npm run build
```

## Docs

| Doc | Purpose |
|-----|---------|
| [`docs/architecture.md`](docs/architecture.md) | Architecture overview |
| [`docs/geopulse-backend-plan.md`](docs/geopulse-backend-plan.md) | Implementation plan |
| [`docs/setup/`](docs/setup/) | Firestore, Auth, Functions setup |
| [`docs/adr/`](docs/adr/) | Architecture decision records |

## Docker

```bash
cd apps/api
docker build -t geopulse-api .
docker run --rm -p 8080:8080 --env-file .env geopulse-api
curl -s http://localhost:8080/health
```

## Deploy

Optional Render Blueprint: [`render.yaml`](render.yaml). After the API is live, set Functions
`API_BASE_URL` and run `firebase deploy --only functions`.

## Swapping in IP-Meta as the IP provider

1. Implement `apps/api/src/providers/ip/ipMetaProvider.ts`
2. Set `IP_PROVIDER=ipmeta` in `.env`
3. Remove the “not selectable” guard in `providers/ip/index.ts` when ready

## CI

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) — lint, typecheck, test, coverage, build (api + functions), Docker image.
