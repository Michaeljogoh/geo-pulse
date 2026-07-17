import type { MarketProvider } from '../types.js';
import { CoinGeckoProvider } from './coinGeckoProvider.js';

/** Market provider factory. */
export function getMarketProvider(): MarketProvider {
  return new CoinGeckoProvider();
}
