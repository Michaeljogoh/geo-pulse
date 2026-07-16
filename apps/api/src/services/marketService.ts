import type { CacheResult } from '../cache/types.js';
import type { Coin, TrendingResult } from '../types/domain.js';

/** Phase 8 — market + trending service. */
export async function getMarket(
  _vs: string,
  _limit: number,
): Promise<CacheResult<Coin[]>> {
  throw new Error('Not implemented: marketService.getMarket (Phase 8)');
}

export async function getTrending(_vs: string): Promise<CacheResult<TrendingResult>> {
  throw new Error('Not implemented: marketService.getTrending (Phase 8)');
}
