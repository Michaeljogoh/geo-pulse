# GeoIP Crypto Intelligence — Backend

Node 22 + Express + TypeScript API that orchestrates IP intelligence, crypto markets, and news
behind a standard `{ data, meta, error }` envelope. Firebase Auth protects user routes; Firestore
is L2 cache + persistence; Cloud Functions warm cache and prune logs.

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
| `apps/functions` | Firebase scheduled functions (no import from `apps/api`) |

## Prerequisites

- Node.js `>=22`
- Firebase project (Firestore Native + Authentication)
- Java 21+ only for Firestore/Functions emulators
- Docker (optional, for container runs)

## Quick start (<10 minutes)

```bash
git clone <repo-url> && cd geo-pulse

# API
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
npm test                 # full suite (MSW; no real network)
npm run test:coverage    # coverage report (html under coverage/)
npm run test:firestore   # emulator DoD (needs Java)
```

```bash
cd apps/functions
npm install && npm test && npm run build
```

## Firestore emulator

See [`docs/setup/firestore.md`](docs/setup/firestore.md). Port **8085**.

## Firebase Auth

See [`docs/setup/firebase-auth.md`](docs/setup/firebase-auth.md).

Protected routes require `Authorization: Bearer <Firebase ID token>`.

## Cloud Functions

See [`docs/setup/functions.md`](docs/setup/functions.md).

```bash
# from repo root — set API_BASE_URL to the live API first
firebase deploy --only functions
firebase deploy --only firestore:indexes
```

## Docker (API)

```bash
cd apps/api
cp .env.example .env   # real values
docker build -t geoip-api .
docker run --rm -p 8080:8080 --env-file .env geoip-api
curl -s http://localhost:8080/health
```

Graceful shutdown: `SIGTERM`/`SIGINT` close the HTTP server and drain in-flight requests
(10s force-exit timeout) — see `apps/api/src/index.ts`.

## Deploy API (Render)

[`render.yaml`](render.yaml) is an optional Blueprint. Create a Web Service from
`apps/api/Dockerfile`, set env vars in the dashboard (never commit secrets), health check `/health`.

After deploy:

1. Point `API_BASE_URL` on Cloud Functions to `https://YOUR_SERVICE`
2. Verify:

```bash
curl -s https://YOUR_API/health
curl -s https://YOUR_API/docs/
curl -s https://YOUR_API/api/dashboard
curl -s https://YOUR_API/api/me                    # 401
curl -s -H "Authorization: Bearer $ID_TOKEN" \
  https://YOUR_API/api/me                          # 200
```

## API docs

Interactive Swagger UI: `GET /docs` · Raw OpenAPI 3.1: `GET /openapi.json`

## Swapping in IP-Meta as the IP provider

v1 ships with `ipapi` (primary) and `ipwho` (fallback). `ipmeta` is a disabled stub.

1. Implement the live client in `apps/api/src/providers/ip/ipMetaProvider.ts`
2. Allow selection in `env.ts` / `.env`:

```bash
IP_PROVIDER=ipmeta
```

3. The factory in `providers/ip/index.ts` already keys off `IP_PROVIDER` — remove the
   `ipmeta is not selectable` guard once the provider is production-ready.

Record an ADR if IP-Meta adds new runtime dependencies.

## CI

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs lint, typecheck, test, coverage,
and build for `apps/api`, plus build/test for `apps/functions`, and a Docker image build.

## Architecture plan

Implementation phases and contracts: `docs/geoip-crypto-intel-backend-plan.md` (local docs;
may be gitignored depending on repo policy). ADRs live under `docs/adr/`.
