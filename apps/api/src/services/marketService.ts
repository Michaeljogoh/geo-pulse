import type { CacheResult } from '../cache/types.js';
import type { Coin, TrendingResult } from '../types/domain.js';

/** Phase 8 — market + trending service. */
export async function getMarket(
  _vs: string,
  _limit: number,
): Promise<CacheResult<Coin[]>> {
  throw Object.assign(new Error('Not implemented: marketService.getMarket (Phase 8)'), {
    isUpstream: true,
  });
}

export async function getTrending(_vs: string): Promise<CacheResult<TrendingResult>> {
  throw Object.assign(new Error('Not implemented: marketService.getTrending (Phase 8)'), {
    isUpstream: true,
  });
}
