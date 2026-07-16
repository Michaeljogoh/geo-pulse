import type { Coin, TrendingCoin } from '../../types/domain.js';
import type { MarketProvider } from '../types.js';

/** Phase 8 — CoinGecko market provider. */
export class CoinGeckoProvider implements MarketProvider {
  readonly name = 'coingecko';

  async getMarkets(_vs: string, _limit: number): Promise<Coin[]> {
    throw new Error('Not implemented: CoinGeckoProvider.getMarkets (Phase 8)');
  }

  async getTrending(): Promise<TrendingCoin[]> {
    throw new Error('Not implemented: CoinGeckoProvider.getTrending (Phase 8)');
  }
}
