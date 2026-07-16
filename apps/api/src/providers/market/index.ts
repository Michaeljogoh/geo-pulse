import type { MarketProvider } from '../types.js';
import { CoinGeckoProvider } from './coinGeckoProvider.js';

/** Phase 8 — market provider factory. */
export function getMarketProvider(): MarketProvider {
  return new CoinGeckoProvider();
}
