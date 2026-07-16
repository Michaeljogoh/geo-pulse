# Frontend Implementation Plan — GeoIP Crypto Intelligence Dashboard

**Project:** GeoIP Crypto Intelligence Platform — Frontend (Web) App
**Audience:** Any autonomous coding agent (or engineer) implementing this end to end.
**Companion to:** `geoip-crypto-intel-backend-plan.md` (this app consumes that API).
**Goal:** A production-ready, responsive Next.js dashboard that consumes the backend REST API,
personalizes itself to the visitor (currency, locale, region, network intelligence), and presents
crypto market data, trending coins, local news, and live API health — with first-class loading,
error, and degraded states.

**Stack (fixed):** Next.js (App Router) + TypeScript + Tailwind CSS v4 + shadcn/ui +
TanStack Query (server state) + Zustand (client state) + Recharts (charts). Deploy to Vercel.

---

## 0. How to use this document

This plan is **sequential**. Each Phase depends on the Phases before it. Each Phase has:
**Goal**, **Depends on**, **Files**, **Spec**, **Acceptance criteria**, **Definition of Done (DoD)**.

### Anti-hallucination rules for the implementing agent

1. **Consume only the backend endpoints and shapes defined in Section 5.** These mirror the backend
  plan exactly. Never invent endpoints, query params, or response fields.
2. **Do not add libraries** beyond the "Approved dependencies" list (Section 2) without an ADR.
3. If a backend field is `null`, render an explicit **"—" / "Unknown"** state. Never fabricate values.
  (This mirrors IP-Meta's own value: *"we'd rather tell you a field is unknown than fake it."*)
4. **Server state → TanStack Query only. Client state → Zustand only.** Do not fetch data inside
  Zustand, and do not store server data in Zustand.
5. Every network call goes through the **typed API client** (Section 6). No raw `fetch`/`axios` in components.
6. Complete a phase's **Acceptance criteria** and run its **DoD** before starting the next.
7. Use the design tokens (Section 8). No hardcoded hex colors, spacing, or font sizes in components.
8. Prefer server components for static shell; use client components only where interactivity/hooks are needed.

---

## 1. Architecture & data-flow decisions

### 1.1 Where fetching happens (critical — read carefully)

The dashboard is **personalized by the visitor's IP**. The backend detects the caller IP from
`X-Forwarded-For`. Therefore the **browser calls the backend directly** (client-side, via TanStack
Query) so the backend sees the real visitor IP — **not** the Next.js server's IP.

- **Server Components** render the static shell (layout, headings, skeletons) for fast first paint + SEO.
- **Client Components** (wrapped in the Query provider) fetch all personalized data from the backend.
- The backend URL is public (`NEXT_PUBLIC_API_BASE_URL`); the backend already enforces CORS allowlist +
rate limiting (see backend plan). No secrets live in the frontend.

> Record this as `docs/adr/0001-client-side-fetching-for-ip-personalization.md`.

### 1.2 State ownership


| State                 | Tool                 | Examples                                                   |
| --------------------- | -------------------- | ---------------------------------------------------------- |
| **Server state**      | TanStack Query       | geo, market, trending, news, status                        |
| **Client (UI) state** | Zustand              | currency override, theme (light/dark), auto-refresh toggle |
| **URL state**         | Next.js searchParams | optional `?ip=` demo override, `?vs=` currency             |


### 1.3 High-level diagram

```text
┌───────────────────────── Next.js App (Vercel) ─────────────────────────┐
│  app/layout.tsx (Server)                                                 │
│    └─ Providers (Client): QueryClientProvider + ThemeProvider            │
│         └─ app/page.tsx (Server shell) → <Dashboard/> (Client)           │
│              ├─ VisitorIntelligenceCard   ─┐                             │
│              ├─ MarketOverview            │  TanStack Query hooks        │
│              ├─ TrendingPanel             │  → typed API client         │
│              ├─ NewsFeed                  │  → GET {NEXT_PUBLIC_API_BASE}│
│              └─ ApiHealthPanel           ─┘     /api/*                   │
│  Zustand store: currency override, theme, refresh interval               │
└─────────────────────────────────────────────────────────────────────────┘
                                   │  (browser → backend, real client IP)
                                   ▼
                        Backend REST API (separate service)
```

---

## 2. Approved dependencies

**Runtime**

- `next`, `react`, `react-dom`
- `@tanstack/react-query` — server state
- `zustand` — client state
- `tailwindcss` (v4) + `@tailwindcss/postcss` + `postcss` — styling
- shadcn/ui generated components (Radix UI primitives pulled in by the CLI)
- `class-variance-authority`, `clsx`, `tailwind-merge` — shadcn utilities
- `lucide-react` — icons
- `recharts` — charts
- `next-themes` — dark mode
- `sonner` — toasts
- `date-fns` — relative timestamps (news)
- `zod` — validate API responses at the boundary (reuse backend contracts)

**Dev / test**

- `typescript`, `@types/`*
- `vitest`, `@testing-library/react`, `@testing-library/user-event`, `jsdom`
- `msw` — mock the backend API in tests (reuse handler style from backend plan)
- `@tanstack/react-query` test utilities
- `eslint`, `eslint-config-next`, `prettier`, `prettier-plugin-tailwindcss`
- (optional) `@playwright/test` — one smoke E2E

> No other runtime dependencies without an ADR.

---

## 3. Global configuration values (single source of truth)

Define in `src/config/constants.ts`. No magic numbers in components.


| Constant                  | Value      | Meaning                                   |
| ------------------------- | ---------- | ----------------------------------------- |
| `QUERY_STALE_GEO_MS`      | `21600000` | Geo stale time (6h) — matches backend TTL |
| `QUERY_STALE_MARKET_MS`   | `60000`    | Market stale time                         |
| `QUERY_REFETCH_MARKET_MS` | `60000`    | Auto-refetch prices every 60s             |
| `QUERY_STALE_TRENDING_MS` | `300000`   | Trending stale time (5m)                  |
| `QUERY_STALE_NEWS_MS`     | `600000`   | News stale time (10m)                     |
| `QUERY_STALE_STATUS_MS`   | `15000`    | Status stale time                         |
| `QUERY_REFETCH_STATUS_MS` | `30000`    | Status auto-refetch                       |
| `QUERY_RETRY`             | `2`        | Query retry count                         |
| `DEFAULT_CURRENCY`        | `USD`      | Fallback when geo has no currency         |
| `DEFAULT_LOCALE`          | `en-US`    | Fallback locale for Intl formatting       |
| `MARKET_LIMIT`            | `20`       | Coins requested for market table          |
| `GAINERS_LOSERS_COUNT`    | `7`        | Rows in gainers/losers                    |


---

## 4. Environment variables


| Var                        | Required | Example                          | Notes                                                   |
| -------------------------- | -------- | -------------------------------- | ------------------------------------------------------- |
| `NEXT_PUBLIC_API_BASE_URL` | yes      | `https://geoip-api.onrender.com` | Backend base URL (no trailing slash). Public by design. |
| `NEXT_PUBLIC_APP_NAME`     | no       | `GeoIP Crypto Intelligence`      | Branding                                                |


Commit `.env.example` with placeholders. No secrets in the frontend (all keys live in the backend).

---

## 5. Backend API contract consumed (mirror of backend plan — do not deviate)

Base: `${NEXT_PUBLIC_API_BASE_URL}/api`. All responses use the envelope:

```typescript
interface ResponseMeta {
  requestId: string;
  source: 'live' | 'cache-l1' | 'cache-l2' | 'fallback';
  provider?: string;
  latencyMs: number;
  cached: boolean;
  confidence?: number | null;
  lastUpdated?: string | null;
  degraded?: boolean;
}
interface ApiError { code: string; message: string; details?: unknown; }
interface ApiResponse<T> { data: T | null; meta: ResponseMeta; error: ApiError | null; }
```

Endpoints (see backend Section 9 for full detail):


| Method | Path             | Query                           | Returns (`data`)                                               |
| ------ | ---------------- | ------------------------------- | -------------------------------------------------------------- |
| GET    | `/api/geo`       | `ip?`                           | `IpIntelligence`                                               |
| GET    | `/api/market`    | `vs?`, `limit?`                 | `Coin[]`                                                       |
| GET    | `/api/trending`  | `vs?`                           | `TrendingResult`                                               |
| GET    | `/api/news`      | `country?`, `symbols?`, `lang?` | `NewsItem[]`                                                   |
| GET    | `/api/dashboard` | `ip?`                           | `DashboardPayload`                                             |
| GET    | `/api/status`    | —                               | `{ providers: ProviderHealth[]; cache: {...}; uptimeSeconds }` |
| GET    | `/health`        | —                               | `{ status; uptimeSeconds; version }` (no envelope)             |


**Primary strategy:** use `GET /api/dashboard` for the initial personalized payload (one request,
parallel-fetched server-side, includes `degraded` + per-section meta). Use the granular endpoints
(`/api/market`, `/api/status`) for **auto-refreshing** widgets (prices, health) so the whole page
doesn't refetch every 60s.

Domain types (`IpIntelligence`, `Coin`, `TrendingResult`, `NewsItem`, `DashboardPayload`,
`SectionMeta`, `ProviderHealth`) are defined in backend Section 6 — **copy them verbatim** into
`src/types/domain.ts` (or import from a shared `packages/types` if extracted).

---

## 6. Typed API client (`src/lib/api/`)

- `client.ts`: `apiGet<T>(path, params?)` → builds URL from `NEXT_PUBLIC_API_BASE_URL`, sets
`Accept: application/json`, applies an `AbortController` timeout (10s), parses the envelope, and:
  - throws a typed `ApiClientError { code, message, requestId, status }` when `error !== null` or HTTP not ok;
  - returns `{ data, meta }` on success.
- `endpoints.ts`: one typed function per endpoint: `getGeo(ip?)`, `getMarket(vs, limit)`,
`getTrending(vs)`, `getNews(params)`, `getDashboard(ip?)`, `getStatus()`.
- `schemas.ts`: Zod schemas for each `data` shape (reuse backend contracts); validate responses at the
boundary; on parse failure throw `ApiClientError('INVALID_RESPONSE')`.
- **No component may call `fetch` directly** — always via these functions.

---

## 7. Project structure

```text
apps/web/
├── src/
│   ├── app/
│   │   ├── layout.tsx                 # Server: html/body, fonts, Providers
│   │   ├── page.tsx                   # Server: shell + <Dashboard/> (client)
│   │   ├── globals.css                # Tailwind v4 @import + @theme tokens
│   │   └── error.tsx / not-found.tsx  # route-level error + 404
│   ├── components/
│   │   ├── providers.tsx              # QueryClientProvider + ThemeProvider (client)
│   │   ├── dashboard/
│   │   │   ├── Dashboard.tsx          # composition (client)
│   │   │   ├── VisitorIntelligenceCard.tsx
│   │   │   ├── NetworkBadge.tsx
│   │   │   ├── MarketOverview.tsx
│   │   │   ├── MarketTable.tsx
│   │   │   ├── TrendingPanel.tsx
│   │   │   ├── GainersLosers.tsx
│   │   │   ├── NewsFeed.tsx
│   │   │   ├── NewsCard.tsx
│   │   │   ├── ApiHealthPanel.tsx
│   │   │   └── MetaFooterBadge.tsx    # shows source/latency/confidence
│   │   ├── layout/
│   │   │   ├── Header.tsx             # brand, currency switch, theme toggle
│   │   │   ├── Footer.tsx
│   │   │   └── Container.tsx
│   │   ├── common/
│   │   │   ├── SectionCard.tsx        # consistent card wrapper w/ title + meta slot
│   │   │   ├── ErrorState.tsx
│   │   │   ├── EmptyState.tsx
│   │   │   ├── LoadingSkeletons.tsx
│   │   │   └── LatencyBadge.tsx
│   │   └── ui/                        # shadcn/ui generated components
│   ├── hooks/
│   │   ├── useGeo.ts
│   │   ├── useMarket.ts
│   │   ├── useTrending.ts
│   │   ├── useNews.ts
│   │   ├── useDashboard.ts
│   │   └── useStatus.ts
│   ├── store/
│   │   └── uiStore.ts                 # Zustand: currency, theme intent, refresh toggle
│   ├── lib/
│   │   ├── api/ (client.ts, endpoints.ts, schemas.ts)
│   │   ├── format.ts                  # Intl currency/number/date helpers
│   │   ├── locale.ts                  # derive locale from countryCode/timezone
│   │   └── utils.ts                   # cn() (clsx + tailwind-merge)
│   ├── types/
│   │   └── domain.ts                  # copied from backend Section 6
│   └── config/
│       └── constants.ts              # Section 3
├── tests/
│   ├── setup.ts                       # MSW + RTL setup
│   ├── msw/handlers.ts
│   └── unit/ , component/
├── public/
├── .env.example
├── components.json                    # shadcn config
├── postcss.config.mjs
├── next.config.ts
├── tsconfig.json
├── vitest.config.ts
└── package.json
```

---

## 8. Design system (Tailwind v4 + shadcn/ui)

### 8.1 Tailwind v4 setup (CSS-first — no `tailwind.config.js`)

- Install: `npm i -D tailwindcss @tailwindcss/postcss postcss`.
- `postcss.config.mjs`: `export default { plugins: { '@tailwindcss/postcss': {} } }`.
- `globals.css` starts with `@import "tailwindcss";` and defines tokens via `@theme { ... }`.
- Dark mode via `next-themes` (class strategy); define light/dark CSS variables.

### 8.2 Design tokens (`@theme` in `globals.css`)

Brand-aligned with IP-Meta's product feel (developer-tool, dark, precise). All components reference
these tokens (via shadcn CSS variables), never raw hex.

- **Color roles:** `background`, `foreground`, `card`, `muted`, `border`, `primary` (a confident
blue/cyan echoing IP-Meta), `success` (gainers), `destructive` (losers), `warning` (degraded).
- **Radius:** single `--radius` scale.
- **Typography:** a clean sans (e.g. Geist/Inter) for UI, a mono (e.g. Geist Mono) for IPs/ASNs/latency
— the mono details reinforce the "developer tooling" identity.
- **Semantic status colors:** `residential`, `mobile`, `datacenter`, `proxy_vpn`, `unknown` badge colors.

### 8.3 shadcn/ui components to generate

`card`, `badge`, `button`, `table`, `tabs`, `skeleton`, `tooltip`, `separator`, `dropdown-menu`,
`switch`, `avatar`, `scroll-area`, `sonner` (toast). Generate via the shadcn CLI (Tailwind v4 mode).

### 8.4 Formatting helpers (`src/lib/format.ts`) — deterministic

```
formatCurrency(value, currency, locale) → Intl.NumberFormat(locale,{style:'currency',currency})
formatCompact(value, locale)            → notation:'compact' (market cap, volume)
formatPercent(value)                    → signed, 2dp, + / - prefix
formatRelativeTime(iso)                 → date-fns formatDistanceToNow
formatLatency(ms)                       → `${ms} ms`
```

`locale` comes from `deriveLocale(countryCode)` with `DEFAULT_LOCALE` fallback. `currency` comes from
`geo.currency ?? DEFAULT_CURRENCY`, overridable via the Zustand currency switch.

---

## 9. Phases (build order)

> Legend: **Depends on**, **Files**, **Spec**, **Acceptance**, **DoD**.

### Phase 0 — Project setup

**Depends on:** backend plan Phase 0 (contracts stable). 
**Files:** Next.js app scaffold, `tsconfig.json`, `postcss.config.mjs`, `globals.css`,
`components.json`, `.eslintrc`/`eslint.config`, `.prettierrc`, `.env.example`, `src/config/constants.ts`.
**Spec:**

- Scaffold Next.js (App Router, TypeScript, `src/` dir, ESLint). Node `>=22`, `.nvmrc`.
- Install Tailwind v4 (Section 8.1) and initialize shadcn/ui in Tailwind-v4 mode.
- `package.json` scripts: `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `test:watch`, `format`.
- Add `src/config/constants.ts` (Section 3) and `.env.example` (Section 4).
**Acceptance:** `npm run dev` renders a blank styled page; `npm run typecheck` + `npm run lint` pass;
Tailwind utility classes apply; one shadcn `Button` renders.
**DoD:** `npm install && npm run typecheck && npm run lint && npm run build`.

---

### Phase 1 — Design tokens & theming

**Depends on:** Phase 0.
**Files:** `globals.css` (`@theme` tokens + light/dark vars), `components/providers.tsx`
(ThemeProvider via `next-themes`), `components/layout/Header.tsx` (theme toggle), `lib/utils.ts` (`cn`).
**Spec:** implement Section 8.2 tokens; light + dark palettes; `cn()` helper; theme toggle switch;
mono font for technical values.
**Acceptance:** toggling theme switches palette with no flash (suppressHydrationWarning + next-themes);
tokens resolve; no hardcoded hex in components.
**DoD:** `npm run build` + visual check of light/dark.

---

### Phase 2 — Domain types + typed API client

**Depends on:** Phase 0.
**Files:** `src/types/domain.ts`, `src/lib/api/client.ts`, `endpoints.ts`, `schemas.ts`.
**Spec:** copy domain types verbatim from backend Section 6; implement the client + endpoint functions

- Zod validation (Section 6). `ApiClientError` carries `code`, `message`, `requestId`, `status`.
**Acceptance:** unit tests (MSW): success returns `{data,meta}`; envelope `error` → throws
`ApiClientError` with code; invalid shape → `INVALID_RESPONSE`; timeout → `ApiClientError('TIMEOUT')`.
**DoD:** `tests/unit/apiClient.test.ts` passes.

---

### Phase 3 — Server-state layer (TanStack Query)

**Depends on:** Phases 1, 2.
**Files:** `components/providers.tsx` (add `QueryClientProvider`), `hooks/useGeo.ts`, `useMarket.ts`,
`useTrending.ts`, `useNews.ts`, `useDashboard.ts`, `useStatus.ts`.
**Spec:**

- Configure `QueryClient` defaults: `retry: QUERY_RETRY`, `refetchOnWindowFocus: false`,
sensible `gcTime`. Do **not** retry on 4xx `ApiClientError`.
- Query keys: `['geo', ip]`, `['market', vs, limit]`, `['trending', vs]`, `['news', params]`,
`['dashboard', ip]`, `['status']`.
- Apply per-query `staleTime`/`refetchInterval` from Section 3 (market + status auto-refetch).
- Each hook returns typed `{ data, meta, isLoading, isError, error, isFetching }`.
**Acceptance:** hooks fetch via the client; market query auto-refetches on interval (fake timers test);
4xx does not retry.
**DoD:** `tests/unit/hooks.test.ts` passes.

---

### Phase 4 — Client-state (Zustand)

**Depends on:** Phase 1.
**Files:** `src/store/uiStore.ts`.
**Spec:** store `{ currencyOverride: string | null; autoRefresh: boolean; setCurrencyOverride; toggleAutoRefresh }`. Persist to `localStorage` (zustand `persist`). Theme is owned by `next-themes`;
Zustand only tracks non-theme UI prefs. The effective currency = `currencyOverride ?? geo.currency ?? DEFAULT_CURRENCY`.
**Acceptance:** setting currency override persists across reload; `autoRefresh=false` disables market
refetch interval (wired in Phase 7).
**DoD:** `tests/unit/uiStore.test.ts` passes.

---

### Phase 5 — App shell & layout

**Depends on:** Phases 1, 3.
**Files:** `app/layout.tsx`, `app/page.tsx`, `components/layout/Header.tsx`, `Footer.tsx`,
`Container.tsx`, `components/common/SectionCard.tsx`, `components/dashboard/Dashboard.tsx` (skeleton composition).
**Spec:**

- `layout.tsx` (Server): fonts, `<Providers>`, base background.
- `page.tsx` (Server): page heading + `<Dashboard/>` (client).
- Header: brand/app name, **currency switch** (dropdown), **theme toggle**, **auto-refresh switch**.
- `SectionCard`: consistent titled card with a `meta` slot (for source/latency/confidence badge).
- Responsive grid: 1 col mobile → 2–3 col desktop.
**Acceptance:** shell renders responsively; header controls wired to Zustand; empty section cards show skeletons.
**DoD:** `npm run build` + responsive check at 375px / 768px / 1280px.

---

### Phase 6 — Visitor Intelligence section

**Depends on:** Phases 3, 5.
**Files:** `components/dashboard/VisitorIntelligenceCard.tsx`, `NetworkBadge.tsx`,
`components/common/LatencyBadge.tsx`, `MetaFooterBadge.tsx`, `lib/locale.ts`.
**Spec:**

- Consume `useGeo` (or the `visitor` slice of `useDashboard`).
- Display: country + flag, city, region, timezone, currency, ISP, organization, ASN (mono),
latitude/longitude.
- `NetworkBadge`: colored badge per `networkType` (`residential`/`mobile`/`datacenter`/`proxy_vpn`/`unknown`).
- **Confidence signal:** render `confidence` as a small meter/percentage (IP-Meta value).
- `MetaFooterBadge`: show `meta.source` (live/cache), `meta.provider`, and `LatencyBadge(meta.latencyMs)`.
- `null` fields render as "—"/"Unknown" (never fabricated).
**Acceptance:** with a mock geo response, all fields + network badge + confidence + latency render;
null fields show "Unknown"; VPN mock shows the proxy/VPN badge.
**DoD:** `tests/component/visitorIntelligence.test.tsx` passes.

---

### Phase 7 — Market Overview section

**Depends on:** Phases 3, 4, 6.
**Files:** `components/dashboard/MarketOverview.tsx`, `MarketTable.tsx`, `lib/format.ts`.
**Spec:**

- Consume `useMarket(vs, MARKET_LIMIT)` where `vs = effectiveCurrency` (Zustand override → geo → default).
- Table columns: rank, coin (icon+name+symbol), price (`formatCurrency`), 24h % (`formatPercent`,
green/red), market cap (`formatCompact`), volume (`formatCompact`).
- Prices update live via `refetchInterval` (respect `autoRefresh` Zustand flag).
- Show `isFetching` subtle indicator (background refresh), full skeleton only on first load.
- Changing currency (header switch) refetches with the new `vs`.
**Acceptance:** coins render in the effective currency; 24h color-coding correct; toggling currency
updates prices; disabling auto-refresh stops interval; first load shows skeleton.
**DoD:** `tests/component/marketOverview.test.tsx` passes.

---

### Phase 8 — Trending & Gainers/Losers section

**Depends on:** Phases 3, 7.
**Files:** `components/dashboard/TrendingPanel.tsx`, `GainersLosers.tsx`. (Optional Recharts bar of % change.)
**Spec:**

- Consume `useTrending(vs)` → `TrendingResult { trending, gainers, losers }`.
- Trending: list with thumb, name, symbol, rank.
- Gainers/Losers: two lists (top `GAINERS_LOSERS_COUNT`) with signed % (color-coded).
- Optional: a small Recharts horizontal bar chart of gainers/losers % (uses only existing data —
**no new backend endpoint**).
**Acceptance:** trending + gainers + losers render; empty arrays → `EmptyState`.
**DoD:** `tests/component/trending.test.tsx` passes.

---

### Phase 9 — Local News section

**Depends on:** Phases 3, 6.
**Files:** `components/dashboard/NewsFeed.tsx`, `NewsCard.tsx`.
**Spec:**

- Consume `useNews({ country: geo.countryCode, lang: 'en' })`.
- `NewsCard`: title (links out, `target=_blank rel="noopener noreferrer"`), source, relative time
(`formatRelativeTime`), optional image, sentiment badge (positive/negative/neutral) when present.
- Graceful: no image → text-only card; empty → `EmptyState`.
**Acceptance:** news items render with source + relative time; sentiment badge shows when present;
missing image handled; empty state shown for no results.
**DoD:** `tests/component/news.test.tsx` passes.

---

### Phase 10 — API Health / Status section (mirrors IP-Meta's own dashboard)

**Depends on:** Phases 3, 5.
**Files:** `components/dashboard/ApiHealthPanel.tsx`.
**Spec:**

- Consume `useStatus()` (auto-refetch every `QUERY_REFETCH_STATUS_MS`).
- Show per-provider: name, circuit state (closed/open/half_open) as a colored dot, last success time,
avg latency; plus cache hit ratio and uptime.
- This intentionally resembles IP-Meta's Request Logs / dashboard — a deliberate product nod.
**Acceptance:** provider rows render with correct status colors; auto-refreshes; degraded provider
shows warning state.
**DoD:** `tests/component/apiHealth.test.tsx` passes.

---

### Phase 11 — Dashboard composition & degraded handling

**Depends on:** Phases 6–10.
**Files:** `components/dashboard/Dashboard.tsx`, `app/error.tsx`, `app/not-found.tsx`.
**Spec:**

- Assemble all sections in the responsive grid.
- **Degraded UX:** if `meta.degraded`/section `SectionMeta.ok === false`, show a non-blocking
inline warning on that section (e.g. "Live data unavailable — showing cached/last-known") while
other sections render normally. The page never fully errors because one API is down.
- Each section independently shows loading/error/empty; a single failing section does not blank the page.
- Global `error.tsx` catches unexpected render errors with a retry action.
**Acceptance:** with a mock where news fails but others succeed, the page renders fully with only the
news section showing its error/degraded state.
**DoD:** `tests/component/dashboardDegraded.test.tsx` passes.

---

### Phase 12 — Cross-cutting UX polish

**Depends on:** Phases 6–11.
**Files:** `components/common/LoadingSkeletons.tsx`, `ErrorState.tsx`, `EmptyState.tsx`; toasts (`sonner`).
**Spec:**

- Consistent skeletons per section (match final layout to avoid layout shift).
- `ErrorState` with retry (calls the query's `refetch`).
- Toast on manual refresh success/failure (optional).
- All numbers/dates go through `lib/format.ts` with the visitor's locale/currency.
**Acceptance:** no layout shift between skeleton and loaded; errors offer retry; consistent formatting.
**DoD:** visual review + `npm run build`.

---

### Phase 13 — Accessibility, responsiveness, performance

**Depends on:** Phase 12.
**Files:** touch-ups across components; `next.config.ts` (image config if used).
**Spec:**

- A11y: semantic landmarks, labeled controls, keyboard-navigable dropdown/switch/tabs, visible focus,
color contrast AA, `aria-live="polite"` on auto-updating price region, alt text on images.
- Responsive at 375 / 768 / 1280; no horizontal scroll; tables scroll within `scroll-area` on mobile.
- Perf: memoize heavy lists, `next/image` for coin/news images, avoid unnecessary re-renders
(select narrow Zustand slices), lazy-load Recharts.
**Acceptance:** keyboard-only navigation works; Lighthouse a11y ≥ 95; no console warnings.
**DoD:** Lighthouse a11y + performance pass on a production build.

---

### Phase 14 — Testing

**Depends on:** all prior.
**Files:** `tests/setup.ts`, `tests/msw/handlers.ts`, unit + component tests, optional Playwright smoke.
**Spec:**

- MSW handlers for every backend endpoint (fixtures mirroring backend Section 12 shapes).
- Component tests (RTL) for each section: loading, success, error, empty, degraded, null-field rendering.
- Unit tests: api client, hooks (fake timers for refetch), format helpers, uiStore.
- Optional: one Playwright smoke test (page loads, key sections visible) against MSW or a mock server.
- No real network in tests (MSW intercepts).
**Acceptance:** `npm test` green; meaningful coverage of client/hooks/components/formatters.
**DoD:** `npm run test` (and `test:coverage`) pass.

---

### Phase 15 — Deployment & README

**Depends on:** Phase 14.
**Files:** `README.md`, `.env.example`, Vercel project settings.
**Spec:**

- Deploy to **Vercel**; set `NEXT_PUBLIC_API_BASE_URL` to the live backend; ensure the backend's
`CORS_ALLOWED_ORIGINS` includes the Vercel domain.
- README: overview, screenshots/GIF, architecture note (client-side fetching for IP personalization),
prerequisites, local setup, env vars, run/test commands, live links (frontend + backend + `/docs`),
and a short "design decisions" section (server vs client state, degraded handling, confidence signals).
**Acceptance:** live URL renders the personalized dashboard end-to-end against the live backend;
fresh clone runs locally in <10 minutes.
**DoD:** live Vercel URL loads the dashboard with real data; README complete.

---

## 10. Component ↔ data map (quick reference)


| Component                         | Hook / data                  | Key states to handle                                     |
| --------------------------------- | ---------------------------- | -------------------------------------------------------- |
| `VisitorIntelligenceCard`         | `useGeo` / dashboard.visitor | loading, error, null fields, VPN badge, confidence       |
| `MarketOverview` / `MarketTable`  | `useMarket(vs)`              | first-load skeleton, background refetch, currency change |
| `TrendingPanel` / `GainersLosers` | `useTrending(vs)`            | empty arrays, color-coded %                              |
| `NewsFeed` / `NewsCard`           | `useNews(country)`           | empty, missing image, sentiment optional                 |
| `ApiHealthPanel`                  | `useStatus`                  | auto-refresh, provider states, degraded                  |
| `Dashboard`                       | composition                  | per-section isolation, global degraded banner            |
| `Header`                          | Zustand + next-themes        | currency switch, theme toggle, auto-refresh toggle       |


---

## 11. Cross-cutting requirements (apply to every phase)

- **Type safety:** `strict` TS; no `any`; validate API responses with Zod at the boundary.
- **Separation of concerns:** components render; hooks fetch (TanStack Query); Zustand holds UI prefs;
formatting isolated in `lib/format.ts`. No `fetch` in components.
- **Honest empty/unknown states:** `null` → "Unknown"/"—", never fabricated (IP-Meta value).
- **Resilience UX:** one failing section never blanks the page; degraded/cached states are visible, not hidden.
- **Performance:** avoid layout shift (matched skeletons), memoize lists, narrow Zustand selectors,
lazy charts, `next/image`.
- **Accessibility:** AA contrast, keyboard nav, labels, `aria-live` for live prices.
- **DRY/SOLID/KISS:** one API client, one card wrapper (`SectionCard`), one formatting module, one store.
- **Security:** no secrets in frontend; external links use `rel="noopener noreferrer"`; the only public
var is the backend base URL.

---

## 12. Definition of Done (whole frontend)

1. All 15 phases complete; each DoD passed.
2. `npm run typecheck`, `npm run lint`, `npm run test` all green; production `npm run build` succeeds.
3. Dashboard renders all sections against the live backend, personalized by visitor IP.
4. Degraded handling verified (one API down → page still works).
5. Light/dark themes, responsive at 375/768/1280, Lighthouse a11y ≥ 95.
6. Currency switch + auto-refresh toggle work and persist.
7. Deployed to Vercel; live URL works end-to-end; CORS configured on backend.
8. README complete with live links, setup, and design-decision notes.

---

## 13. Build order quick reference (dependency chain)

```
0 setup (Next + Tailwind v4 + shadcn)
└─1 design tokens + theming
  └─2 domain types + API client
    └─3 TanStack Query hooks
      ├─4 Zustand UI store
      └─5 app shell & layout
          └─6 Visitor Intelligence
            └─7 Market Overview (needs 4 for currency/refresh)
              └─8 Trending / Gainers-Losers
                └─9 News feed
                  └─10 API Health panel
                    └─11 Dashboard composition + degraded handling
                      └─12 UX polish (skeletons/errors/empty)
                        └─13 a11y + responsive + perf
                          └─14 testing (MSW + RTL)
                            └─15 deploy (Vercel) + README
```

Each node must be **green** (its DoD) before starting the next.

---

## 14. Notes on standing out (frontend-specific)

- **Mirror IP-Meta's product**: the API Health panel and the confidence/latency/source badges on every
section echo their own developer dashboard and their stated values ("accuracy over freshness theater",
"speed is a feature"). This signals you studied their product.
- **Server vs client state separation** (TanStack Query + Zustand) is a concrete senior-engineering
decision worth one line in the README.
- **Degraded-but-usable UX** demonstrates the fault-tolerance the role explicitly asks for
("scaling challenges we encounter daily").
- **Emerging-markets awareness**: correct `Intl` currency/locale formatting for any country reflects
their value "built for emerging markets too".

