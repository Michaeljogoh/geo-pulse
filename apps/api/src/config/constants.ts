/** Global configuration values — single source of truth (plan Section 3). */

export const HTTP_TIMEOUT_MS = 5000;
export const HTTP_TIMEOUT_NEWS_MS = 8000;
export const HTTP_MAX_RETRIES = 2;
export const HTTP_BACKOFF_BASE_MS = 300;
export const HTTP_BACKOFF_FACTOR = 2;
export const HTTP_BACKOFF_JITTER_MS = 100;

export const CB_FAILURE_THRESHOLD = 5;
export const CB_OPEN_MS = 30000;
export const CB_HALF_OPEN_MAX_CALLS = 1;

export const CACHE_TTL_GEO_S = 21600;
export const CACHE_TTL_MARKET_S = 60;
export const CACHE_TTL_TRENDING_S = 300;
export const CACHE_TTL_NEWS_S = 600;
export const CACHE_L1_CHECK_PERIOD_S = 120;

export const RATE_LIMIT_WINDOW_MS = 60000;
export const RATE_LIMIT_MAX = 60;

export const MARKET_DEFAULT_LIMIT = 20;
export const MARKET_MAX_LIMIT = 100;

/** Documented demo IP used when the caller address is private/loopback (Section 9.2). */
export const DEMO_PUBLIC_IP = '8.8.8.8';

/** Max coins on a user watchlist (Phase 15). */
export const WATCHLIST_MAX_ITEMS = 50;
