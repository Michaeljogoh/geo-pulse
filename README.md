# GeoPulse — Backend

GeoPulse is an **IP-personalized crypto intelligence API**. It resolves a visitor’s location and network from their IP, then returns live market data and crypto news in a currency and context that match where they are.

This repository contains the backend only: an Express REST API plus optional Firebase Cloud Functions for cache warming and log cleanup.

## Related repositories

| Repo | Link |
|------|------|
| **Backend** (this repo) | [github.com/Michaeljogoh/geo-pulse-backend](https://github.com/Michaeljogoh/geo-pulse-backend) |
| **Frontend** (dashboard UI) | [github.com/Michaeljogoh/geo-pulse-frontend](https://github.com/Michaeljogoh/geo-pulse-frontend) |

The UI lives in a separate repo. After this API is running, follow the [frontend README](https://github.com/Michaeljogoh/geo-pulse-frontend#readme) to run the dashboard against it.

## What it does

- **Visitor intelligence** — country, city, currency, ISP/ASN, and network type from IP (with a demo IP fallback for localhost)
- **Market data** — top coins, trending, gainers/losers via CoinGecko, priced in the visitor’s currency
- **Crypto news** — CryptoCompare primary feed with optional GNews regional fallback
- **Dashboard aggregate** — one endpoint that combines geo + market + trending + news (partial failures degrade, never blank the whole response)
- **Auth & watchlist** — Firebase ID tokens; per-user watchlists enriched with live prices
- **Reliability** — L1 memory + L2 Firestore cache, retries, circuit breakers, provider health, request logging
- **Docs** — OpenAPI + Swagger UI at `/docs`

## Architecture

```text
Clients ──► apps/api (Express + TypeScript)
               ├─ providers (ip-api / ipwho, CoinGecko, CryptoCompare / GNews)
               ├─ L1 node-cache + L2 Firestore cache
               └─ Firestore: users, watchlists, request_logs, provider_health

         apps/functions (scheduled)
               ├─ warmCache        → HTTP GET hot API routes
               └─ pruneRequestLogs → delete old request_logs
```

| Package | Role |
|---------|------|
| [`apps/api`](apps/api) | REST API + OpenAPI |
| [`apps/functions`](apps/functions) | Firebase scheduled jobs (does not import `apps/api`) |

## Prerequisites

- Node.js **22+**
- A Firebase project (Firestore Native mode + Authentication)
- Provider API keys (see below)
- Java 21+ only if you run Firestore emulators
- Docker optional

## Quick start

```bash
git clone https://github.com/Michaeljogoh/geo-pulse-backend.git
cd geo-pulse-backend/apps/api
cp .env.example .env
# Fill FIREBASE_* and CRYPTOCOMPARE_API_KEY at minimum
# Add GNEWS_API_KEY for regional news fallback
# Set CORS_ALLOWED_ORIGINS to include http://localhost:3000 for the frontend

npm install
npm run dev
```

- Health: [http://localhost:8080/health](http://localhost:8080/health)
- Swagger: [http://localhost:8080/docs](http://localhost:8080/docs)

Then clone and run the UI: [geo-pulse-frontend](https://github.com/Michaeljogoh/geo-pulse-frontend) with `NEXT_PUBLIC_API_BASE_URL=http://localhost:8080`.

Env template: [`apps/api/.env.example`](apps/api/.env.example).

### Required environment (summary)

| Variable | Purpose |
|----------|---------|
| `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` | Admin SDK (Auth verify + Firestore) |
| `CRYPTOCOMPARE_API_KEY` | Primary crypto news |
| `CORS_ALLOWED_ORIGINS` | Comma-separated frontend origins |
| `GNEWS_API_KEY` | Optional news fallback |
| `COINGECKO_DEMO_KEY` | Optional higher CoinGecko rate limits |
| `AUTH_ENABLED` | `true` in production; `false` only for local bypass |

Get a free CryptoCompare key: [cryptocompare.com/cryptopian/api-keys](https://www.cryptocompare.com/cryptopian/api-keys).

## Core API surfaces

| Method | Path | Notes |
|--------|------|-------|
| `GET` | `/health` | Liveness (no envelope) |
| `GET` | `/api/geo` | IP intelligence |
| `GET` | `/api/market` | Markets by `vs` currency |
| `GET` | `/api/trending` | Trending + gainers/losers |
| `GET` | `/api/news` | Crypto news |
| `GET` | `/api/dashboard` | Aggregated personalized payload |
| `GET` | `/api/status` | Provider circuits + cache stats |
| `GET` | `/api/me` | Auth required |
| `GET/PUT/DELETE` | `/api/watchlist` | Auth required |

All `/api/*` responses use `{ data, meta, error }`.

## Scripts (`apps/api`)

```bash
npm run dev            # watch mode
npm run build && npm start
npm test               # Vitest + MSW
npm run test:coverage
npm run test:firestore # needs Java + Firebase emulators
npm run lint
npm run typecheck
```

```bash
cd apps/functions
npm install && npm test && npm run build
```

## Docker

```bash
cd apps/api
docker build -t geopulse-api .
docker run --rm -p 8080:8080 --env-file .env geopulse-api
curl -s http://localhost:8080/health
```

## Deploy

Optional Render Blueprint: [`render.yaml`](render.yaml). After the API is live, set Functions `API_BASE_URL` and run `firebase deploy --only functions`.

## Further docs

| Doc | Purpose |
|-----|---------|
| [`docs/architecture.md`](docs/architecture.md) | System design |
| [`docs/setup/`](docs/setup/) | Firestore, Auth, Functions setup |
| [`docs/adr/`](docs/adr/) | Architecture decisions |
| [`docs/geopulse-backend-plan.md`](docs/geopulse-backend-plan.md) | Historical implementation plan |
| [Frontend README](https://github.com/Michaeljogoh/geo-pulse-frontend#readme) | Dashboard setup and env vars |
