import { cacheManager } from '../cache/cacheManager.js';
import type { CacheResult } from '../cache/types.js';
import { CACHE_TTL_MARKET_S, CACHE_TTL_TRENDING_S } from '../config/constants.js';
import { withResilience } from '../providers/withResilience.js';
import { getMarketProvider } from '../providers/market/index.js';
import { pickGainersLosers } from '../providers/market/coinGeckoProvider.js';
import type { Coin, TrendingResult } from '../types/domain.js';

/** Cached market and trending lookups. */
export async function getMarket(vs: string, limit: number): Promise<CacheResult<Coin[]>> {
  const currency = vs.toLowerCase();
  return cacheManager.getOrSet(`market:${currency}:${limit}`, CACHE_TTL_MARKET_S, async () => {
    const provider = getMarketProvider();
    const wrapped = await withResilience(provider.name, () =>
      provider.getMarkets(currency, limit),
    );
    return wrapped.result;
  });
}

export async function getTrending(vs: string): Promise<CacheResult<TrendingResult>> {
  const currency = vs.toLowerCase();
  return cacheManager.getOrSet(`trending:${currency}`, CACHE_TTL_TRENDING_S, async () => {
    const provider = getMarketProvider();

    const [trendingWrapped, marketsWrapped] = await Promise.all([
      withResilience(provider.name, () => provider.getTrending()),
      withResilience(provider.name, () => provider.getMarkets(currency, 100)),
    ]);

    const { gainers, losers } = pickGainersLosers(marketsWrapped.result);

    return {
      trending: trendingWrapped.result,
      gainers,
      losers,
    };
  });
}
