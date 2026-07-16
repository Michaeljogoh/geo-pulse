/** Section 10 — Firestore collection names (single source of truth). */
export const COLLECTIONS = {
  CACHE: 'cache',
  REQUEST_LOGS: 'request_logs',
  PROVIDER_HEALTH: 'provider_health',
  USERS: 'users',
  WATCHLISTS: 'watchlists',
  META: '_meta',
} as const;

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];

export const PROVIDER_IDS = [
  'ipapi',
  'ipwho',
  'coingecko',
  'cryptopanic',
  'gnews',
] as const;

export type ProviderId = (typeof PROVIDER_IDS)[number];
