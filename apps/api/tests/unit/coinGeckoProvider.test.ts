import { describe, expect, it } from 'vitest';

import {
  mapCoinGeckoMarket,
  mapCoinGeckoTrendingItem,
  pickGainersLosers,
} from '../../src/providers/market/coinGeckoProvider.js';
import { coinGeckoMarketsFixture, makeMarketCoin } from '../msw/handlers.js';

describe('CoinGecko mappers (Section 12.3)', () => {
  it('maps a markets item to Coin', () => {
    const coin = mapCoinGeckoMarket(coinGeckoMarketsFixture[0], 'eur');
    expect(coin).toMatchObject({
      id: 'bitcoin',
      symbol: 'BTC',
      currency: 'eur',
      currentPrice: 60000,
    });
    expect(coin.priceChangePct24h).toBe(2);
  });

  it('maps a trending item', () => {
    const trending = mapCoinGeckoTrendingItem({
      item: {
        id: 'solana',
        name: 'Solana',
        symbol: 'sol',
        market_cap_rank: 5,
        thumb: 'https://example.com/t.png',
      },
    });
    expect(trending).toEqual({
      id: 'solana',
      name: 'Solana',
      symbol: 'SOL',
      marketCapRank: 5,
      thumb: 'https://example.com/t.png',
    });
  });

  it('picks top gainers and losers', () => {
    const coins = coinGeckoMarketsFixture.map((raw) => mapCoinGeckoMarket(raw, 'usd'));
    const { gainers, losers } = pickGainersLosers(coins);
    expect(gainers[0]?.id).toBe('cardano');
    expect(losers[0]?.id).toBe('ripple');
    expect(gainers).toHaveLength(7);
    expect(losers).toHaveLength(7);
  });

  it('ignores null price changes when ranking', () => {
    const coins = [
      mapCoinGeckoMarket(makeMarketCoin({ id: 'a', price_change_percentage_24h: 10 }), 'usd'),
      mapCoinGeckoMarket(
        { ...makeMarketCoin({ id: 'b' }), price_change_percentage_24h: null },
        'usd',
      ),
    ];
    const { gainers } = pickGainersLosers(coins);
    expect(gainers.map((c) => c.id)).toEqual(['a']);
  });
});

describe('CoinGeckoProvider.getMarketsByIds (Phase 15)', () => {
  it('is declared on the MarketProvider interface via class', async () => {
    const { CoinGeckoProvider } = await import('../../src/providers/market/coinGeckoProvider.js');
    expect(typeof new CoinGeckoProvider().getMarketsByIds).toBe('function');
  });
});
