import { cacheManager } from '../cache/cacheManager.js';
import { CACHE_TTL_MARKET_S } from '../config/constants.js';
import { withResilience } from '../providers/withResilience.js';
import { getMarketProvider } from '../providers/market/index.js';
import {
  addCoin,
  getWatchlist as readWatchlist,
  removeCoin,
  type WatchlistCoin,
} from '../repositories/watchlistRepository.js';
import type { Coin, WatchlistItem } from '../types/domain.js';

async function fetchMarketsByIds(ids: string[], vs: string): Promise<Coin[]> {
  if (ids.length === 0) return [];
  const currency = vs.toLowerCase();
  const cacheKey = `market:ids:${currency}:${[...ids].map((id) => id.toLowerCase()).sort().join(',')}`;

  const cached = await cacheManager.getOrSet(cacheKey, CACHE_TTL_MARKET_S, async () => {
    const provider = getMarketProvider();
    const wrapped = await withResilience(provider.name, () =>
      provider.getMarketsByIds(ids, currency),
    );
    return wrapped.result;
  });

  return cached.value;
}

function enrich(entries: WatchlistCoin[], markets: Coin[]): WatchlistItem[] {
  const byId = new Map(markets.map((c) => [c.id, c]));
  return entries.map((entry) => {
    const coin = byId.get(entry.coinId) ?? null;
    return {
      coinId: entry.coinId,
      available: coin !== null,
      coin,
      addedAt: entry.addedAt,
    };
  });
}

/**
 * Phase 15 — read watchlist and enrich with live CoinGecko prices.
 * Unknown coin ids → `{ available: false, coin: null }` (never fabricate).
 */
export async function getEnriched(uid: string, vs = 'usd'): Promise<WatchlistItem[]> {
  const entries = await readWatchlist(uid);
  const markets = await fetchMarketsByIds(
    entries.map((e) => e.coinId),
    vs,
  );
  return enrich(entries, markets);
}

/** @deprecated Prefer getEnriched — kept for route naming compatibility. */
export async function getWatchlist(uid: string, vs = 'usd'): Promise<WatchlistItem[]> {
  return getEnriched(uid, vs);
}

export async function addWatchlistItem(
  uid: string,
  coinId: string,
  vs = 'usd',
): Promise<WatchlistItem[]> {
  await addCoin(uid, coinId);
  return getEnriched(uid, vs);
}

export async function removeWatchlistItem(
  uid: string,
  coinId: string,
  vs = 'usd',
): Promise<WatchlistItem[]> {
  await removeCoin(uid, coinId);
  return getEnriched(uid, vs);
}
