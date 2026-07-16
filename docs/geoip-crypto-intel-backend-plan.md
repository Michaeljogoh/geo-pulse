# Backend Implementation Plan — GeoIP Crypto Intelligence API

**Project:** GeoIP Crypto Intelligence Platform — Backend Service
**Audience:** Any autonomous coding agent (or engineer) implementing this end to end.
**Goal:** A production-ready Node.js + Express + TypeScript REST API that orchestrates
multiple external APIs (IP intelligence, crypto market, crypto news), normalizes them,
caches them (in-memory L1 + Firestore L2), and exposes clean, documented, resilient endpoints.

---

## 0. How to use this document

This plan is **sequential**. Each Phase depends on the Phases before it. Do **not** skip
ahead. Each Phase has:

- **Goal** — what this phase delivers.
- **Depends on** — which prior phases must be complete.
- **Files** — the exact files to create or modify (full paths).
- **Spec** — precise implementation detail (types, values, behavior).
- **Acceptance criteria** — objective checks that must pass before moving on.
- **Definition of Done (DoD)** — the command(s) that must succeed.

### Anti-hallucination rules for the implementing agent

1. **Do not invent fields, endpoints, or env vars.** Only use what is defined in this document.
2. **Do not add libraries** beyond the "Approved dependencies" list (Section 2) without recording an ADR.
3. If an external API response field is not listed in the mapping tables (Section 12), treat it as
  `unknown`/optional — never fabricate values.
4. **Never hardcode secrets.** All secrets come from environment variables validated in Phase 1.
5. Every endpoint returns the **standard response envelope** (Section 9). No exceptions except `/health` and `/docs`.
6. Complete the **Acceptance criteria** of a phase before starting the next. Run the **DoD** command.
7. Prefer the exact versions, TTLs, timeouts, and limits in Section 3. If a value is missing, pick a
  sensible default and record it in `docs/adr/`.

---

## 1. Architecture overview

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

**Layering (Dependency Inversion):** Routes depend on Services; Services depend on Provider
**interfaces**; concrete providers (ip-api, CoinGecko, etc.) implement those interfaces. Swapping
the IP provider for IP-Meta later is a one-line factory change.

---

## 2. Approved dependencies

**Runtime**

- `express` — HTTP framework
- `firebase-admin` — Firestore access (Admin SDK)
- `node-cache` — L1 in-memory cache
- `axios` — HTTP client (with custom retry interceptor)
- `zod` — validation (env, query params, external responses)
- `pino` + `pino-http` — structured JSON logging
- `helmet` — security headers
- `cors` — CORS allowlist
- `express-rate-limit` — rate limiting
- `swagger-ui-express` — serve API docs
- `yaml` — load OpenAPI YAML at runtime
- `dotenv` — load `.env` in development
- `uuid` — request IDs

**Dev / test**

- `typescript`, `tsx` (dev runner), `@types/`*
- `vitest` — test runner
- `supertest` — HTTP integration tests
- `msw` — mock external HTTP in tests
- `eslint`, `@typescript-eslint/*`, `prettier`

> No other runtime dependencies without an ADR. The circuit breaker is **hand-rolled** (Phase 4),
> not a library.

---

## 3. Global configuration values (single source of truth)

Define these in `src/config/constants.ts`. Reference them everywhere — never inline magic numbers.


| Constant                  | Value   | Meaning                                        |
| ------------------------- | ------- | ---------------------------------------------- |
| `HTTP_TIMEOUT_MS`         | `5000`  | Default upstream request timeout               |
| `HTTP_TIMEOUT_NEWS_MS`    | `8000`  | News providers can be slower                   |
| `HTTP_MAX_RETRIES`        | `2`     | Retries after first attempt (3 total attempts) |
| `HTTP_BACKOFF_BASE_MS`    | `300`   | Exponential backoff base                       |
| `HTTP_BACKOFF_FACTOR`     | `2`     | Backoff multiplier                             |
| `HTTP_BACKOFF_JITTER_MS`  | `100`   | Max random jitter added per retry              |
| `CB_FAILURE_THRESHOLD`    | `5`     | Consecutive failures before opening circuit    |
| `CB_OPEN_MS`              | `30000` | How long circuit stays open before half-open   |
| `CB_HALF_OPEN_MAX_CALLS`  | `1`     | Trial calls allowed in half-open               |
| `CACHE_TTL_GEO_S`         | `21600` | Geo lookup cache TTL (6h)                      |
| `CACHE_TTL_MARKET_S`      | `60`    | Market data cache TTL                          |
| `CACHE_TTL_TRENDING_S`    | `300`   | Trending cache TTL                             |
| `CACHE_TTL_NEWS_S`        | `600`   | News cache TTL                                 |
| `CACHE_L1_CHECK_PERIOD_S` | `120`   | node-cache expiry sweep interval               |
| `RATE_LIMIT_WINDOW_MS`    | `60000` | Rate-limit window                              |
| `RATE_LIMIT_MAX`          | `60`    | Max requests per window per IP                 |
| `MARKET_DEFAULT_LIMIT`    | `20`    | Default coins per market request               |
| `MARKET_MAX_LIMIT`        | `100`   | Max coins per market request                   |


---

## 4. Environment variables

All are validated at boot (Phase 1). App must **exit with a clear error** if a required var is missing or malformed.


| Var                     | Required | Example                                         | Notes                                                           |
| ----------------------- | -------- | ----------------------------------------------- | --------------------------------------------------------------- |
| `NODE_ENV`              | yes      | `development`                                   | `development` | `production` | `test`                           |
| `PORT`                  | no       | `8080`                                          | Default `8080`                                                  |
| `LOG_LEVEL`             | no       | `info`                                          | pino level                                                      |
| `CORS_ALLOWED_ORIGINS`  | yes      | `http://localhost:3000,https://app.example.com` | Comma-separated allowlist                                       |
| `FIREBASE_PROJECT_ID`   | yes      | `geoip-crypto-intel`                            |                                                                 |
| `FIREBASE_CLIENT_EMAIL` | yes      | `sa@...iam.gserviceaccount.com`                 | Service account                                                 |
| `FIREBASE_PRIVATE_KEY`  | yes      | `-----BEGIN PRIVATE KEY-----\n...`              | Escaped newlines; unescape at load                              |
| `IP_PROVIDER`           | no       | `ipapi`                                         | `ipapi` | `ipwho` (default `ipapi`); `ipmeta` reserved/disabled |
| `COINGECKO_BASE_URL`    | no       | `https://api.coingecko.com/api/v3`              | Default set                                                     |
| `COINGECKO_DEMO_KEY`    | no       | `CG-xxxx`                                       | Optional, raises rate limit                                     |
| `CRYPTOPANIC_TOKEN`     | yes      | `xxxx`                                          | Free token                                                      |
| `GNEWS_API_KEY`         | no       | `xxxx`                                          | Enables regional news fallback                                  |
| `CACHE_ENABLED`         | no       | `true`                                          | Toggle caching (default `true`)                                 |


Provide a committed `.env.example` with every var and placeholder values. **Never commit real values.**

---

## 5. Project structure (backend package: `apps/api`)

```text
apps/api/
├── src/
│   ├── index.ts                     # bootstrap + graceful shutdown
│   ├── app.ts                       # createApp(): assembles express app
│   ├── config/
│   │   ├── env.ts                   # zod-validated env (Phase 1)
│   │   └── constants.ts             # Section 3 values
│   ├── types/
│   │   ├── domain.ts                # IpIntelligence, Coin, NewsItem, etc.
│   │   └── envelope.ts              # ApiResponse<T>, ResponseMeta, ApiError
│   ├── lib/
│   │   ├── logger.ts                # pino instance (Phase 1)
│   │   ├── errors.ts                # AppError classes + error codes (Phase 2)
│   │   ├── envelope.ts              # ok()/fail() builders (Phase 2)
│   │   ├── requestId.ts             # id generator (Phase 2)
│   │   ├── hash.ts                  # stable cache-key hashing (Phase 5)
│   │   ├── httpClient.ts            # axios + retry interceptor (Phase 3)
│   │   ├── circuitBreaker.ts        # hand-rolled breaker (Phase 4)
│   │   └── firestore.ts             # Admin SDK init (Phase 6)
│   ├── middleware/
│   │   ├── requestContext.ts        # attach requestId + child logger (Phase 2)
│   │   ├── validate.ts              # zod query/param validator (Phase 2)
│   │   ├── rateLimiter.ts           # express-rate-limit config (Phase 2)
│   │   ├── notFound.ts              # 404 handler (Phase 2)
│   │   └── errorHandler.ts          # central error → envelope (Phase 2)
│   ├── cache/
│   │   ├── types.ts                 # CacheStore interface (Phase 5)
│   │   ├── memoryCache.ts           # L1 node-cache (Phase 5)
│   │   ├── firestoreCache.ts        # L2 Firestore (Phase 5, wired Phase 6)
│   │   └── cacheManager.ts          # two-tier getOrSet (Phase 5)
│   ├── providers/
│   │   ├── types.ts                 # provider interfaces (Phase 7)
│   │   ├── withResilience.ts        # wrap provider call w/ breaker+retry+timing (Phase 7)
│   │   ├── ip/
│   │   │   ├── ipApiProvider.ts     # (Phase 7)
│   │   │   ├── ipWhoProvider.ts     # (Phase 7)
│   │   │   ├── ipMetaProvider.ts    # disabled stub (Phase 7)
│   │   │   └── index.ts             # factory + fallback chain (Phase 7)
│   │   ├── market/
│   │   │   ├── coinGeckoProvider.ts # (Phase 8)
│   │   │   └── index.ts             # (Phase 8)
│   │   └── news/
│   │       ├── cryptoPanicProvider.ts # (Phase 9)
│   │       ├── gNewsProvider.ts       # (Phase 9)
│   │       └── index.ts               # (Phase 9)
│   ├── services/
│   │   ├── geoService.ts            # (Phase 7)
│   │   ├── marketService.ts         # (Phase 8)
│   │   ├── newsService.ts           # (Phase 9)
│   │   ├── dashboardService.ts      # (Phase 10)
│   │   └── statusService.ts         # (Phase 11)
│   ├── repositories/
│   │   ├── requestLogRepository.ts  # (Phase 13)
│   │   └── providerHealthRepository.ts # (Phase 13)
│   ├── routes/
│   │   ├── index.ts                 # mounts all routers (Phase 2+)
│   │   ├── health.route.ts          # (Phase 2)
│   │   ├── geo.route.ts             # (Phase 7)
│   │   ├── market.route.ts          # (Phase 8)
│   │   ├── news.route.ts            # (Phase 9)
│   │   ├── dashboard.route.ts       # (Phase 10)
│   │   └── status.route.ts          # (Phase 11)
│   └── docs/
│       ├── openapi.yaml             # OpenAPI 3.1 spec (Phase 12)
│       └── swagger.ts               # mounts /docs + /openapi.json (Phase 12)
├── tests/
│   ├── unit/
│   ├── integration/
│   └── msw/
│       ├── handlers.ts              # (Phase 14)
│       └── server.ts                # (Phase 14)
├── Dockerfile                       # (Phase 15)
├── .dockerignore                    # (Phase 15)
├── .env.example                     # (Phase 1)
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── .eslintrc.cjs
└── .prettierrc
```

> This plan covers the **backend package only** (`apps/api`). Domain types live in
> `src/types/` and can be extracted to `packages/types` for the frontend later (record an ADR if done).

---

## 6. Domain types (single definition — `src/types/domain.ts`)

These are the **only** normalized shapes the API returns. Providers map raw responses into these.

```typescript
export type NetworkType = 'residential' | 'mobile' | 'datacenter' | 'proxy_vpn' | 'unknown';

export interface IpIntelligence {
  ip: string;
  country: string | null;
  countryCode: string | null;   // ISO 3166-1 alpha-2
  city: string | null;
  region: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;      // IANA, e.g. "Africa/Lagos"
  currency: string | null;      // ISO 4217, e.g. "NGN"
  isp: string | null;
  organization: string | null;
  asn: string | null;           // e.g. "AS15169"
  asnName: string | null;
  isProxy: boolean | null;      // null = provider could not determine
  isHosting: boolean | null;    // datacenter
  isMobile: boolean | null;
  networkType: NetworkType;
  confidence: number;           // 0..1 (see Section 12.4)
}

export interface Coin {
  id: string;
  symbol: string;
  name: string;
  image: string | null;
  currentPrice: number;
  currency: string;             // vs_currency used
  marketCap: number | null;
  marketCapRank: number | null;
  priceChangePct24h: number | null;
  totalVolume: number | null;
  high24h: number | null;
  low24h: number | null;
  lastUpdated: string;          // ISO 8601
}

export interface TrendingCoin {
  id: string;
  name: string;
  symbol: string;
  marketCapRank: number | null;
  thumb: string | null;
}

export interface TrendingResult {
  trending: TrendingCoin[];
  gainers: Coin[];              // top +priceChangePct24h
  losers: Coin[];              // top -priceChangePct24h
}

export interface NewsItem {
  title: string;
  url: string;
  source: string | null;
  publishedAt: string;         // ISO 8601
  sentiment: 'positive' | 'negative' | 'neutral' | null;
  imageUrl: string | null;
}

export interface DashboardPayload {
  visitor: IpIntelligence;
  market: Coin[];
  trending: TrendingResult;
  news: NewsItem[];
  sections: {
    market: SectionMeta;
    trending: SectionMeta;
    news: SectionMeta;
  };
  degraded: boolean;           // true if any section failed
}

export interface SectionMeta {
  ok: boolean;
  source: 'live' | 'cache-l1' | 'cache-l2' | 'fallback' | 'error';
  latencyMs: number;
  error: string | null;
}
```

---

## 7. Response envelope (`src/types/envelope.ts`)

Every endpoint (except `/health`, `/docs`, `/openapi.json`) returns:

```typescript
export interface ResponseMeta {
  requestId: string;
  source: 'live' | 'cache-l1' | 'cache-l2' | 'fallback';
  provider?: string;
  latencyMs: number;
  cached: boolean;
  confidence?: number | null;   // present for IP intelligence
  lastUpdated?: string | null;  // ISO of underlying data
  degraded?: boolean;
}

export interface ApiError {
  code: ErrorCode;              // Section 8
  message: string;             // human-readable, safe to show
  details?: unknown;           // validation issues, etc. (never secrets)
}

export interface ApiResponse<T> {
  data: T | null;
  meta: ResponseMeta;
  error: ApiError | null;
}
```

**Success example:**

```json
{
  "data": { "ip": "8.8.8.8", "country": "United States", "networkType": "datacenter", "confidence": 0.9 },
  "meta": { "requestId": "b1f...", "source": "live", "provider": "ipapi", "latencyMs": 42, "cached": false, "confidence": 0.9 },
  "error": null
}
```

**Error example:**

```json
{
  "data": null,
  "meta": { "requestId": "b1f...", "source": "live", "latencyMs": 3, "cached": false },
  "error": { "code": "VALIDATION_ERROR", "message": "Invalid query parameter: vs", "details": [{ "path": "vs", "issue": "must be a 3-letter code" }] }
}
```

---

## 8. Error taxonomy (`src/lib/errors.ts`)


| `ErrorCode`        | HTTP status | When                                           |
| ------------------ | ----------- | ---------------------------------------------- |
| `VALIDATION_ERROR` | 400         | Zod query/param validation fails               |
| `NOT_FOUND`        | 404         | Unknown route or resource                      |
| `RATE_LIMITED`     | 429         | Client exceeded rate limit                     |
| `UPSTREAM_TIMEOUT` | 504         | External API timed out (after retries)         |
| `UPSTREAM_ERROR`   | 502         | External API returned an unrecoverable error   |
| `CIRCUIT_OPEN`     | 503         | Circuit breaker open for the required provider |
| `INTERNAL`         | 500         | Unexpected error                               |


`AppError` base class carries `{ code, httpStatus, message, details?, isOperational }`.
The central `errorHandler` maps `AppError` → envelope. Unknown errors → `INTERNAL` (never leak stack/messages to client in production; always log full error with requestId).

---

## 9. API endpoints (contracts)

Base path: `/api`. All list/query params validated with Zod (Phase 2 middleware).

### 9.1 `GET /health`  (no envelope)

- **Purpose:** liveness/readiness probe.
- **200:** `{ "status": "ok", "uptimeSeconds": 123, "version": "1.0.0", "timestamp": "ISO" }`
- No external calls. Must respond even if Firestore is down (report `firestore: "up"|"down"` field).

### 9.2 `GET /api/geo`

- **Query:** `ip?` (optional; valid IPv4/IPv6). If omitted, resolve caller IP from `X-Forwarded-For` (first entry) then `req.socket.remoteAddress`.
- **Data:** `IpIntelligence`
- **Cache:** key `geo:{ip}`, TTL `CACHE_TTL_GEO_S`.
- **Notes:** If caller IP is private/loopback (e.g. `::1`, `127.0.0.1`, `10.x`), use a documented demo IP (`8.8.8.8`) and set `meta.provider` accordingly; do **not** error.

### 9.3 `GET /api/market`

- **Query:** `vs?` (ISO 4217, default `usd`, lowercased), `limit?` (1..`MARKET_MAX_LIMIT`, default `MARKET_DEFAULT_LIMIT`).
- **Data:** `Coin[]`
- **Cache:** key `market:{vs}:{limit}`, TTL `CACHE_TTL_MARKET_S`.

### 9.4 `GET /api/trending`

- **Query:** `vs?` (default `usd`).
- **Data:** `TrendingResult`
- **Cache:** key `trending:{vs}`, TTL `CACHE_TTL_TRENDING_S`.

### 9.5 `GET /api/news`

- **Query:** `country?` (ISO alpha-2), `symbols?` (comma list, e.g. `BTC,ETH`), `lang?` (default `en`).
- **Data:** `NewsItem[]`
- **Cache:** key `news:{country|any}:{symbols|any}:{lang}`, TTL `CACHE_TTL_NEWS_S`.

### 9.6 `GET /api/dashboard`

- **Query:** `ip?` (as `/api/geo`).
- **Behavior:** resolve visitor geo first (needed for currency + country). Then fetch market, trending, news **in parallel** using the visitor's currency/country. Each section is independent: a failure sets its `SectionMeta.ok=false` and `degraded=true` but the response is still `200`.
- **Data:** `DashboardPayload`
- **Cache:** sections use their own cache keys (reuse geo/market/trending/news caches). The dashboard itself is **not** separately cached.

### 9.7 `GET /api/status`

- **Data:** `{ providers: ProviderHealth[], cache: { l1Keys: number, hitRatio: number }, uptimeSeconds: number }`
- Reads provider health snapshots (Phase 13) + in-memory cache stats. No external calls.

### 9.8 `GET /docs` and `GET /openapi.json` (Phase 12)

- Swagger UI + raw spec. No envelope.

---

## 10. Firestore data model

Firestore in **Native mode**. Collections and document shapes:

### `cache/{cacheKey}`  — L2 shared cache

`cacheKey` = SHA-256 hex of the logical key (Section 9). Fields:

```
key         string        // logical key, e.g. "market:usd:20"
payload     map           // the cached JSON value
source      string        // provider name that produced it
createdAt   Timestamp
expiresAt   Timestamp     // used by reader AND Firestore TTL policy
ttlSeconds  number
```

> Configure a **Firestore TTL policy** on `cache.expiresAt` (documented in README) for auto-cleanup.

### `request_logs/{autoId}` — request logging (Phase 13)

```
requestId   string
method      string
path        string
statusCode  number
ip          string | null
country     string | null
provider    string | null
cacheStatus string        // "hit-l1" | "hit-l2" | "miss" | "n/a"
latencyMs   number
degraded    boolean
userAgent   string | null
createdAt   Timestamp
```

### `provider_health/{provider}` — breaker + metrics snapshot (Phase 13)

`provider` doc id ∈ { `ipapi`, `ipwho`, `coingecko`, `cryptopanic`, `gnews` }.

```
provider        string
state           string     // "closed" | "open" | "half_open"
lastSuccessAt   Timestamp | null
lastFailureAt   Timestamp | null
consecutiveFail number
successCount    number
failureCount    number
avgLatencyMs    number
updatedAt       Timestamp
```

**Indexing:** default single-field indexes suffice for v1. If querying `request_logs` by
`createdAt` desc + filter, add a composite index and commit `firestore.indexes.json`.

**Security:** all access is via Admin SDK from the backend only. No client SDK, no public rules needed.
Do not expose Firestore directly to the browser.

---

## 11. Phases (build order)

> Legend: each phase lists **Depends on**, **Files**, **Spec**, **Acceptance**, **DoD**.

### Phase 0 — Repository & tooling

**Depends on:** none.
**Files:** `package.json`, `tsconfig.json`, `.eslintrc.cjs`, `.prettierrc`, `vitest.config.ts`, `.gitignore`, `.nvmrc` (`22`).
**Spec:**

- `package.json` scripts: `dev` (`tsx watch src/index.ts`), `build` (`tsc -p tsconfig.json`),
`start` (`node dist/index.js`), `test` (`vitest run`), `test:watch`, `lint`, `typecheck` (`tsc --noEmit`), `format`.
- `tsconfig.json`: `strict: true`, `target: ES2022`, `module: NodeNext`, `moduleResolution: NodeNext`,
`outDir: dist`, `rootDir: src`, `esModuleInterop: true`, `skipLibCheck: true`, `noUncheckedIndexedAccess: true`.
- Node engine `>=22`.
**Acceptance:** `npm run typecheck` and `npm run lint` succeed on an empty `src/index.ts` that logs "boot".
**DoD:** `npm install && npm run typecheck && npm run lint`.

---

### Phase 1 — Config, env validation, logger

**Depends on:** Phase 0.
**Files:** `src/config/env.ts`, `src/config/constants.ts`, `src/lib/logger.ts`, `.env.example`.
**Spec:**

- `env.ts`: a Zod schema over `process.env` (Section 4). Coerce numbers, split comma lists,
unescape `FIREBASE_PRIVATE_KEY` (`replace(/\\n/g, '\n')`). On failure, log the formatted Zod
error and `process.exit(1)`. Export a frozen typed `env` object.
- `constants.ts`: export all Section 3 values as `const`.
- `logger.ts`: pino logger; level from `env.LOG_LEVEL`; pretty transport only when `NODE_ENV=development`.
- `.env.example`: every var from Section 4 with placeholders.
**Acceptance:** importing `env` with a missing required var exits with a readable message; with valid
env, `env` is typed and populated.
**DoD:** unit test `tests/unit/env.test.ts` — valid env parses; missing `FIREBASE_PROJECT_ID` throws/exits.

---

### Phase 2 — Express skeleton, middleware, error handling, `/health`

**Depends on:** Phase 1.
**Files:** `src/app.ts`, `src/index.ts`, `src/types/envelope.ts`, `src/lib/errors.ts`,
`src/lib/envelope.ts`, `src/lib/requestId.ts`, `src/middleware/requestContext.ts`,
`src/middleware/validate.ts`, `src/middleware/rateLimiter.ts`, `src/middleware/notFound.ts`,
`src/middleware/errorHandler.ts`, `src/routes/index.ts`, `src/routes/health.route.ts`.
**Spec:**

- `errors.ts`: `AppError` + subclasses per Section 8, each with a factory (e.g. `AppError.validation(details)`).
- `envelope.ts`: `ok(data, metaPartial)` and `fail(error, metaPartial)` builders. `latencyMs`
measured from `res.locals.startTime` set in `requestContext`.
- `requestContext.ts`: generate `requestId` (uuid v4) → `res.locals.requestId`, set `X-Request-Id`
response header, attach `req.log = logger.child({ requestId })`, record `startTime`.
- `validate.ts`: `validateQuery(schema)` middleware → parses `req.query`, on error throws
`AppError.validation(zodIssues)`.
- `rateLimiter.ts`: `express-rate-limit` with `RATE_LIMIT_`*; handler throws `AppError.rateLimited()`;
set standard `RateLimit-*` headers.
- `errorHandler.ts`: last middleware; maps `AppError`→ envelope+status; unknown → `INTERNAL` (log full
error, return generic message in production).
- `app.ts` `createApp()` order: `express.json()` → `requestContext` → `helmet` → `cors(allowlist)` →
`rateLimiter` → routes → `notFound` → `errorHandler`. CORS uses `env.CORS_ALLOWED_ORIGINS`.
- `index.ts`: start server on `env.PORT`; **graceful shutdown** on `SIGTERM`/`SIGINT` (stop accepting,
close server, flush logger). Add `unhandledRejection`/`uncaughtException` handlers that log and exit.
- `/health` per Section 9.1 (Firestore check may return `unknown` until Phase 6).
**Acceptance:** `GET /health` → 200 with correct shape; unknown route → 404 envelope with `NOT_FOUND`;
malformed request that trips validation on a test route → 400 envelope; `X-Request-Id` present on all responses.
**DoD:** `tests/integration/health.test.ts` (supertest) passes.

---

### Phase 3 — Resilient HTTP client

**Depends on:** Phase 2.
**Files:** `src/lib/httpClient.ts`.
**Spec:**

- Factory `createHttpClient({ timeoutMs, name })` returning an axios instance.
- **Retry interceptor:** retry when error is a network error, timeout (`ECONNABORTED`), HTTP `429`,
or `>=500`. **Never** retry other `4xx`. Max `HTTP_MAX_RETRIES`. Delay =
`min(BASE * FACTOR^attempt, 5000) + random(0..JITTER)`; honor `Retry-After` header if present.
- Attach per-request `AbortController`/timeout. On final failure, throw a normalized error object
`{ isTimeout, status, providerName }` (do not throw raw axios error to callers).
- Log each attempt at `debug`, final failure at `warn` with `requestId` if available.
**Acceptance:** unit tests with MSW: (a) a 500-then-200 sequence resolves after 1 retry; (b) a 400
does not retry; (c) a persistent timeout rejects after `HTTP_MAX_RETRIES` with `isTimeout=true`.
**DoD:** `tests/unit/httpClient.test.ts` passes.

---

### Phase 4 — Circuit breaker

**Depends on:** Phase 3.
**Files:** `src/lib/circuitBreaker.ts`.
**Spec:**

- Class `CircuitBreaker(name, { failureThreshold, openMs, halfOpenMaxCalls })`.
- States: `closed` → (on `failureThreshold` consecutive failures) → `open` → (after `openMs`) →
`half_open` → (trial success) → `closed`, or (trial failure) → `open`.
- `exec(fn)`: if `open` and cooldown not elapsed → throw `AppError.circuitOpen(name)`; else run `fn`,
record success/failure, update state. Half-open allows `halfOpenMaxCalls` trial calls only.
- Expose `getSnapshot()` → `{ state, consecutiveFail, successCount, failureCount, lastSuccessAt, lastFailureAt }`.
- Pure/in-memory; no external deps. Deterministic time via injectable `now()` for tests.
**Acceptance:** unit tests cover all transitions: closed→open after threshold; open rejects fast;
open→half_open after `openMs`; half_open→closed on success; half_open→open on failure.
**DoD:** `tests/unit/circuitBreaker.test.ts` passes. Add `docs/adr/0001-hand-rolled-circuit-breaker.md`.

---

### Phase 5 — Cache layer (L1 + L2 + manager)

**Depends on:** Phase 2 (L2 Firestore wiring completes in Phase 6; until then `firestoreCache` is a no-op stub guarded by availability).
**Files:** `src/cache/types.ts`, `src/cache/memoryCache.ts`, `src/cache/firestoreCache.ts`,
`src/cache/cacheManager.ts`, `src/lib/hash.ts`.
**Spec:**

- `hash.ts`: `hashKey(logicalKey)` → SHA-256 hex.
- `types.ts`: `interface CacheStore { get<T>(key): Promise<CacheHit<T> | null>; set<T>(key, value, ttlS, meta): Promise<void>; }`
where `CacheHit` includes `value`, `expiresAt`, `source`.
- `memoryCache.ts`: wraps `node-cache` (`stdTTL` per-entry, `checkperiod = CACHE_L1_CHECK_PERIOD_S`).
Track hits/misses for `/api/status`.
- `firestoreCache.ts`: reads/writes `cache/{hashKey}` (Section 10). On read, if `expiresAt <= now`
treat as miss. On any Firestore error, **fail open** (return null / swallow write) and log `warn` —
cache must never break the request path.
- `cacheManager.ts`: `getOrSet<T>(logicalKey, ttlS, producer)`:
  1. Check L1 → hit returns `{ value, source: 'cache-l1' }`.
  2. Check L2 → hit: populate L1, return `{ source: 'cache-l2' }`.
  3. Miss: `await producer()`, write L1 + L2, return `{ source: 'live' }`.
  4. **Stale-while-error:** if `producer()` throws and an expired L2 entry exists, return the stale
    value with `source: 'fallback'` and log a warning (only when `producer` marks the error retryable/upstream).
  Respect `env.CACHE_ENABLED=false` by bypassing both layers.
  **Acceptance:** unit tests: L1 hit; L1 miss→L2 hit populates L1; full miss calls producer once and
  populates both; stale-while-error returns stale value when producer throws.
  **DoD:** `tests/unit/cacheManager.test.ts` passes (Firestore mocked/in-memory fake).

---

### Phase 6 — Firestore Admin initialization

**Depends on:** Phase 5.
**Files:** `src/lib/firestore.ts`; wire `firestoreCache` into `cacheManager`; update `/health`.
**Spec:**

- `firestore.ts`: initialize `firebase-admin` with cert credentials from `env` (project id, client
email, private key). Export a singleton `db` (Firestore). Lazy-init; guard double-init.
- `/health` reports `firestore: "up"|"down"` via a cheap read (e.g. a `_meta/health` doc get with short timeout).
- Provide a `docs/setup/firestore.md`: how to create the project, service account, and TTL policy on `cache.expiresAt`.
**Acceptance:** with valid credentials, a write+read round-trip to a `cache` doc succeeds against the
Firestore emulator (preferred for tests) or a real project.
**DoD:** `tests/integration/firestore.test.ts` runs against the **Firestore emulator** (documented in README).

---

### Phase 7 — IP intelligence providers + geo service + `/api/geo`

**Depends on:** Phases 3, 4, 5, 6.
**Files:** `src/providers/types.ts`, `src/providers/withResilience.ts`,
`src/providers/ip/ipApiProvider.ts`, `ipWhoProvider.ts`, `ipMetaProvider.ts`, `ip/index.ts`,
`src/services/geoService.ts`, `src/routes/geo.route.ts`.
**Spec:**

- `providers/types.ts`: `interface IpIntelligenceProvider { name: string; lookup(ip: string): Promise<IpIntelligence>; }`
plus `MarketProvider`, `NewsProvider` interfaces (define now, implement later).
- `withResilience.ts`: helper wrapping a provider call in `CircuitBreaker.exec` + timing; returns
`{ result, latencyMs, provider }`; records health snapshot (Phase 13 hooks — no-op until then).
- `ipApiProvider`: `GET http://ip-api.com/json/{ip}?fields=status,message,country,countryCode,region,regionName,city,lat,lon,timezone,currency,isp,org,as,asname,mobile,proxy,hosting,query`.
Validate with a Zod schema; map per Section 12.1. If `status !== "success"` throw `UPSTREAM_ERROR`.
- `ipWhoProvider`: `GET https://ipwho.is/{ip}`; map per Section 12.2; `isProxy/isHosting/isMobile = null`
(not available) → `networkType` derivation yields `unknown` when flags are null.
- `ipMetaProvider`: **stub, disabled.** Throws `AppError` "IP-Meta provider disabled for this assignment"
unless `IP_PROVIDER=ipmeta` (which is not selectable in v1). Include commented mapping to
`GET https://api.ip-meta.xyz/v1/ip-lookup?ip={ip}` for documentation only.
- `ip/index.ts`: `getIpProvider()` returns the primary per `env.IP_PROVIDER`; `resolveIp(ip)` tries
primary then fallback (`ipwho`) if primary throws; annotate which provider succeeded.
- `geoService.ts`: `getGeo(ip)` → `cacheManager.getOrSet('geo:'+ip, CACHE_TTL_GEO_S, () => resolveIp(ip))`.
Handles private/loopback IP substitution (Section 9.2).
- `geo.route.ts`: validate `ip?`; resolve caller IP if absent; return envelope with
`meta.provider`, `meta.confidence`, `meta.source`.
**Acceptance:** `GET /api/geo?ip=8.8.8.8` → normalized `IpIntelligence`; primary-provider failure
falls back to secondary (verified with MSW forcing ip-api to 500); private IP substitutes demo IP;
second identical request served from L1 (`meta.source="cache-l1"`).
**DoD:** `tests/integration/geo.test.ts` + `tests/unit/ipProviders.test.ts` pass.

---

### Phase 8 — Market providers + market service + `/api/market`, `/api/trending`

**Depends on:** Phase 7.
**Files:** `src/providers/market/coinGeckoProvider.ts`, `market/index.ts`,
`src/services/marketService.ts`, `src/routes/market.route.ts` (mounts both `/market` and `/trending`).
**Spec:**

- `coinGeckoProvider`:
  - `getMarkets(vs, limit)` → `GET {COINGECKO_BASE_URL}/coins/markets?vs_currency={vs}&order=market_cap_desc&per_page={limit}&page=1&sparkline=false&price_change_percentage=24h`. Send `x-cg-demo-api-key` header if `COINGECKO_DEMO_KEY` set. Map per Section 12.3.
  - `getTrending()` → `GET {base}/search/trending`. Map per Section 12.3.
  - For gainers/losers: fetch `getMarkets(vs, 100)`, sort by `priceChangePct24h` desc/asc, take top 7 each.
- `marketService`: `getMarket(vs, limit)` and `getTrending(vs)` via `cacheManager` with respective TTLs.
`getTrending` composes CoinGecko trending + gainers/losers into `TrendingResult`.
- `market.route.ts`: validate `vs` (regex `^[a-z]{3,5}$`, default `usd`) and `limit`.
**Acceptance:** `/api/market?vs=eur&limit=5` returns 5 coins priced in EUR; `/api/trending` returns
`trending`, `gainers`, `losers`; cache hit on repeat; CoinGecko 429 triggers retry then, if persistent,
`stale-while-error` or `UPSTREAM_`*.
**DoD:** `tests/integration/market.test.ts` + `tests/unit/coinGeckoProvider.test.ts` pass.

---

### Phase 9 — News providers + news service + `/api/news`

**Depends on:** Phase 8.
**Files:** `src/providers/news/cryptoPanicProvider.ts`, `gNewsProvider.ts`, `news/index.ts`,
`src/services/newsService.ts`, `src/routes/news.route.ts`.
**Spec:**

- `cryptoPanicProvider` (**primary**): `GET https://cryptopanic.com/api/v1/posts/?auth_token={CRYPTOPANIC_TOKEN}&public=true&currencies={symbols|BTC,ETH}&kind=news`. Map per Section 12.5; derive `sentiment` from `votes` if present else `null`.
- `gNewsProvider` (**fallback, regional**): only enabled if `GNEWS_API_KEY` set. `GET https://gnews.io/api/v4/search?q=crypto&lang={lang}&country={country}&max=10&apikey={key}`. Map per Section 12.6.
- `news/index.ts`: `getNews({ country, symbols, lang })` → try CryptoPanic; on failure or empty and
GNews enabled, fall back to GNews; annotate provider used.
- `newsService`: cache per Section 9.5 key + `CACHE_TTL_NEWS_S`.
- `news.route.ts`: validate `country?`, `symbols?` (comma → array, uppercased), `lang?` (default `en`).
**Acceptance:** `/api/news?symbols=BTC,ETH` returns normalized items; CryptoPanic failure with GNews
key set falls back to GNews (MSW-verified); missing GNews key → CryptoPanic-only, no crash.
**DoD:** `tests/integration/news.test.ts` + provider unit tests pass.

---

### Phase 10 — Dashboard aggregation + `/api/dashboard`

**Depends on:** Phases 7, 8, 9.
**Files:** `src/services/dashboardService.ts`, `src/routes/dashboard.route.ts`.
**Spec:**

- `dashboardService.getDashboard(ip)`:
  1. `visitor = geoService.getGeo(ip)` (must succeed; if it fails, still return with `unknown` visitor
    and `degraded=true`, deriving `currency='usd'`, `country=null`).
  2. Derive `vs = (visitor.currency ?? 'USD').toLowerCase()`, `country = visitor.countryCode`.
  3. Run in parallel with `Promise.allSettled`: `marketService.getMarket(vs, 20)`,
    `marketService.getTrending(vs)`, `newsService.getNews({ country, lang: 'en' })`.
  4. For each settled result, fill `DashboardPayload` + `SectionMeta` (`ok`, `source`, `latencyMs`, `error`).
  5. `degraded = any section !ok`.
- Response is always `200`; `meta.degraded` reflects `payload.degraded`.
- `dashboard.route.ts`: validate `ip?`.
**Acceptance:** happy path returns visitor + all sections; forcing news provider down returns `200`
with `sections.news.ok=false`, `degraded=true`, other sections present; currency reflects visitor.
**DoD:** `tests/integration/dashboard.test.ts` passes (partial-failure case included).

---

### Phase 11 — Status endpoint + `/api/status`

**Depends on:** Phase 10 (and Phase 13 health data; before Phase 13 it reports in-memory breaker snapshots).
**Files:** `src/services/statusService.ts`, `src/routes/status.route.ts`.
**Spec:**

- Aggregate: circuit-breaker snapshots per provider (from in-memory registry), L1 cache stats
(keys, hit ratio), process uptime.
- After Phase 13, enrich with persisted `provider_health` (last success/failure timestamps).
**Acceptance:** `/api/status` returns provider states, cache stats, uptime.
**DoD:** `tests/integration/status.test.ts` passes.

---

### Phase 12 — OpenAPI spec + Swagger UI

**Depends on:** Phases 2, 7–11.
**Files:** `src/docs/openapi.yaml`, `src/docs/swagger.ts`; mount in `app.ts`.
**Spec:**

- Hand-write `openapi.yaml` (OpenAPI 3.1) covering every endpoint in Section 9, the response
envelope, and all domain schemas (Section 6). Include examples.
- `swagger.ts`: serve UI at `GET /docs` and raw spec at `GET /openapi.json` (load YAML via `yaml`).
- Keep spec in sync with actual routes (a test asserts every route path appears in the spec).
**Acceptance:** `/docs` renders; `/openapi.json` validates as OpenAPI 3.1; spec lists all endpoints.
**DoD:** `tests/integration/docs.test.ts` (spec parses + contains all paths) passes.

---

### Phase 13 — Persistence: request logging + provider health

**Depends on:** Phases 6, 10.
**Files:** `src/repositories/requestLogRepository.ts`, `src/repositories/providerHealthRepository.ts`;
hook logging middleware in `app.ts`; hook health writes in `withResilience.ts`.
**Spec:**

- `requestLogRepository.create(log)`: **fire-and-forget** write to `request_logs` (Section 10) after
response finishes (`res.on('finish')`). Never block or fail the response; log errors at `warn`.
Capture `cacheStatus`, `degraded`, `country` from `res.locals` set by services/routes.
- `providerHealthRepository.upsert(snapshot)`: throttled write (e.g. at most once/10s per provider) of
circuit-breaker + latency snapshot to `provider_health`. Fail-open.
- Both use a **batched/throttled** approach to avoid Firestore write amplification (note the cost
trade-off in an ADR).
**Acceptance:** hitting an endpoint creates a `request_logs` doc (emulator); provider calls update
`provider_health`; request latency unaffected if Firestore is slow/down.
**DoD:** `tests/integration/logging.test.ts` (emulator) passes.

---

### Phase 14 — Test suite consolidation

**Depends on:** all prior.
**Files:** `tests/msw/handlers.ts`, `tests/msw/server.ts`, plus completion of unit/integration tests.
**Spec:**

- MSW handlers for ip-api, ipwho, CoinGecko, CryptoPanic, GNews with realistic fixtures (from Section 12).
- Coverage focus (meaningful, not 100%): `httpClient`, `circuitBreaker`, `cacheManager`, each provider
mapping, each service, each route, dashboard partial-failure, error handler.
- `vitest.config.ts`: node environment, setup file starting/stopping MSW server, coverage reporter.
- Add `test:coverage` script.
**Acceptance:** `npm test` runs the full suite green; coverage report generated; no real network calls
during tests (MSW intercepts all).
**DoD:** `npm run test:coverage` passes with the interesting logic covered.

---

### Phase 15 — Containerization, CI, hardening

**Depends on:** Phase 14.
**Files:** `Dockerfile`, `.dockerignore`, `.github/workflows/ci.yml`.
**Spec:**

- **Dockerfile:** multi-stage (build with dev deps → `tsc`; runtime image `node:22-alpine`, prod deps
only, non-root user, `EXPOSE 8080`, `CMD ["node","dist/index.js"]`). Add container `HEALTHCHECK`
hitting `/health`.
- **CI (`ci.yml`):** on push/PR — `npm ci` → `lint` → `typecheck` → `test` (with Firestore emulator
service or emulator-skipped unit subset). Cache npm.
- Confirm graceful shutdown (Phase 2) drains in-flight requests before exit.
**Acceptance:** `docker build` succeeds; container serves `/health`; CI workflow is valid and green.
**DoD:** `docker build -t geoip-api . && docker run -p 8080:8080 --env-file .env geoip-api` serves `/health`; CI passes on a test branch.

---

### Phase 16 — Deployment + README

**Depends on:** Phase 15.
**Files:** `README.md` (backend), `docs/setup/`*, `render.yaml` **or** Railway config (optional).
**Spec:**

- README: overview, architecture diagram, prerequisites, env setup (link `.env.example`), local run,
Firestore emulator instructions, test instructions, deploy steps (Render/Railway), API docs link
(`/docs`), and a **"Swapping in IP-Meta as the IP provider"** section (one env var + factory line).
- Deploy the API to Render or Railway; set env vars in the host dashboard (never in the repo).
- Verify the live `/health`, `/docs`, and `/api/dashboard` endpoints post-deploy.
**Acceptance:** live URL serves all endpoints; README lets a fresh clone run locally in <10 minutes.
**DoD:** live deployment URL responds `200` on `/health` and renders `/docs`.

---

## 12. External API → normalized mapping tables

> Only these fields are consumed. Ignore everything else. Missing fields → `null`.

### 12.1 ip-api.com → `IpIntelligence`

Endpoint: `http://ip-api.com/json/{ip}?fields=status,message,country,countryCode,region,regionName,city,lat,lon,timezone,currency,isp,org,as,asname,mobile,proxy,hosting,query`


| Raw field     | Normalized     | Transform                   |
| ------------- | -------------- | --------------------------- |
| `query`       | `ip`           | —                           |
| `country`     | `country`      | —                           |
| `countryCode` | `countryCode`  | —                           |
| `city`        | `city`         | —                           |
| `regionName`  | `region`       | —                           |
| `lat`         | `latitude`     | —                           |
| `lon`         | `longitude`    | —                           |
| `timezone`    | `timezone`     | —                           |
| `currency`    | `currency`     | uppercase                   |
| `isp`         | `isp`          | —                           |
| `org`         | `organization` | —                           |
| `as`          | `asn`          | take leading `AS####` token |
| `asname`      | `asnName`      | —                           |
| `mobile`      | `isMobile`     | boolean                     |
| `proxy`       | `isProxy`      | boolean                     |
| `hosting`     | `isHosting`    | boolean                     |
| —             | `networkType`  | see 12.4                    |
| —             | `confidence`   | see 12.4                    |


If `status !== "success"` → throw `UPSTREAM_ERROR` (message from `message`).

### 12.2 ipwho.is → `IpIntelligence`

Endpoint: `https://ipwho.is/{ip}`


| Raw field        | Normalized                                                    |
| ---------------- | ------------------------------------------------------------- |
| `ip`             | `ip`                                                          |
| `country`        | `country`                                                     |
| `country_code`   | `countryCode`                                                 |
| `city`           | `city`                                                        |
| `region`         | `region`                                                      |
| `latitude`       | `latitude`                                                    |
| `longitude`      | `longitude`                                                   |
| `timezone.id`    | `timezone`                                                    |
| `currency.code`  | `currency`                                                    |
| `connection.isp` | `isp`                                                         |
| `connection.org` | `organization`                                                |
| `connection.asn` | `asn` (prefix `AS` if numeric)                                |
| `connection.isp` | `asnName`                                                     |
| —                | `isProxy` = `null`, `isHosting` = `null`, `isMobile` = `null` |
| —                | `networkType` = `unknown`; `confidence` per 12.4              |


If `success === false` → throw `UPSTREAM_ERROR`.

### 12.3 CoinGecko → `Coin` / `TrendingResult`

`/coins/markets` item → `Coin`:


| Raw                           | Normalized           |
| ----------------------------- | -------------------- |
| `id`                          | `id`                 |
| `symbol`                      | `symbol` (uppercase) |
| `name`                        | `name`               |
| `image`                       | `image`              |
| `current_price`               | `currentPrice`       |
| (query `vs`)                  | `currency`           |
| `market_cap`                  | `marketCap`          |
| `market_cap_rank`             | `marketCapRank`      |
| `price_change_percentage_24h` | `priceChangePct24h`  |
| `total_volume`                | `totalVolume`        |
| `high_24h`                    | `high24h`            |
| `low_24h`                     | `low24h`             |
| `last_updated`                | `lastUpdated`        |


`/search/trending` `coins[].item` → `TrendingCoin`: `id→id`, `name→name`, `symbol→symbol`,
`market_cap_rank→marketCapRank`, `thumb→thumb`.
Gainers/losers: from `getMarkets(vs,100)`, sort by `priceChangePct24h`.

### 12.4 `networkType` + `confidence` derivation (deterministic)

```
if isMobile === true            → networkType = 'mobile'
else if isHosting === true      → networkType = 'datacenter'
else if isProxy === true        → networkType = 'proxy_vpn'
else if isProxy === false && isHosting === false && isMobile === false
                                → networkType = 'residential'
else                            → networkType = 'unknown'

confidence:
  base = 0.5
  +0.2 if country && city present
  +0.2 if asn present
  +0.1 if (isProxy !== null && isHosting !== null && isMobile !== null)  // provider gave flags
  clamp to [0,1]
```

(ip-api typically → ~0.9–1.0; ipwho.is fallback → ~0.7 since flags are null.)

### 12.5 CryptoPanic → `NewsItem`

Endpoint: `https://cryptopanic.com/api/v1/posts/?auth_token={token}&public=true&currencies={symbols}&kind=news`
`results[]`:


| Raw                         | Normalized                                    |
| --------------------------- | --------------------------------------------- |
| `title`                     | `title`                                       |
| `url`                       | `url`                                         |
| `source.title`              | `source`                                      |
| `published_at`              | `publishedAt`                                 |
| `votes` (positive/negative) | `sentiment` (`positive`/`negative`/`neutral`) |
| —                           | `imageUrl` = `null`                           |


### 12.6 GNews → `NewsItem`

Endpoint: `https://gnews.io/api/v4/search?q=crypto&lang={lang}&country={country}&max=10&apikey={key}`
`articles[]`:


| Raw           | Normalized           |
| ------------- | -------------------- |
| `title`       | `title`              |
| `url`         | `url`                |
| `source.name` | `source`             |
| `publishedAt` | `publishedAt`        |
| —             | `sentiment` = `null` |
| `image`       | `imageUrl`           |


---

## 13. Cross-cutting requirements (apply to every phase)

- **Type safety:** `strict` TS everywhere; no `any` (use `unknown` + Zod at boundaries).
- **Validation at boundaries:** validate all inbound query/params (Zod middleware) **and** all
external API responses (Zod schemas in providers). Never trust upstream shapes.
- **Error handling:** no unhandled rejections; all provider errors normalized to `AppError`.
- **Logging:** structured, include `requestId`; never log secrets or full API keys.
- **Security:** helmet on; CORS allowlist only; rate limiting on; secrets only via env; sanitize the
`ip` query param (reject non-IP strings); do not reflect raw upstream error bodies to clients.
- **No secret leakage:** `.env` in `.gitignore`; only `.env.example` committed.
- **Determinism/testability:** inject `now()`/clients where time or network is involved.
- **DRY/SOLID:** one place for envelope building, one HTTP client factory, one cache manager, one
breaker registry; providers depend on interfaces.

---

## 14. Definition of Done (whole backend)

1. All 16 phases complete; each phase's DoD command passed.
2. `npm run typecheck`, `npm run lint`, `npm run test:coverage` all green.
3. Every endpoint in Section 9 works locally against the Firestore emulator and returns the standard envelope.
4. `/docs` renders the full OpenAPI 3.1 spec.
5. Docker image builds and serves `/health`.
6. CI pipeline green.
7. Live deployment URL responds on `/health`, `/docs`, and `/api/dashboard`.
8. README enables a fresh clone to run locally in under 10 minutes.
9. IP-Meta provider swap documented (one env var + one factory line).
10. ADRs present for: hand-rolled circuit breaker, Firestore-over-Redis cache, provider abstraction,
  throttled Firestore logging.

---

## 15. Build order quick reference (dependency chain)

```
0 setup
└─1 config/env/logger
  └─2 express skeleton + middleware + /health
    └─3 http client (retry)
      └─4 circuit breaker
        └─5 cache (L1/L2/manager)
          └─6 firestore init  ──────────────┐
            └─7 IP providers + geoService + /api/geo
              └─8 market providers + /api/market + /api/trending
                └─9 news providers + /api/news
                  └─10 dashboard aggregation + /api/dashboard
                    └─11 /api/status
                      └─12 OpenAPI + /docs
                        └─13 request logs + provider health (needs 6)
                          └─14 test suite (MSW) consolidation
                            └─15 Docker + CI + hardening
                              └─16 deploy + README
```

Each node must be **green** (its DoD) before starting the next.