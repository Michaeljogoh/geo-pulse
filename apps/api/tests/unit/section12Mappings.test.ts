import { describe, expect, it } from 'vitest';

import {
  deriveConfidence,
  deriveNetworkType,
  formatAsn,
  parseAsn,
} from '../../src/lib/ipIntelligence.js';
import { AppError } from '../../src/lib/errors.js';
import { mapIpApiResponse } from '../../src/providers/ip/ipApiProvider.js';
import { mapIpWhoResponse } from '../../src/providers/ip/ipWhoProvider.js';
import {
  mapCoinGeckoMarket,
  mapCoinGeckoTrendingItem,
  pickGainersLosers,
} from '../../src/providers/market/coinGeckoProvider.js';
import {
  deriveSentimentFromVotes,
  mapCryptoPanicPost,
} from '../../src/providers/news/cryptoPanicProvider.js';
import { mapGNewsArticle } from '../../src/providers/news/gNewsProvider.js';

/**
 * Section 12 golden tests — every transform in the plan mapping tables.
 * Missing fields → null (or domain-required defaults where noted).
 */
describe('Section 12.1 ip-api.com → IpIntelligence', () => {
  const raw = {
    status: 'success' as const,
    query: '1.2.3.4',
    country: 'Nigeria',
    countryCode: 'NG',
    regionName: 'Lagos',
    city: 'Lagos',
    lat: 6.5244,
    lon: 3.3792,
    timezone: 'Africa/Lagos',
    currency: 'ngn',
    isp: 'Example ISP',
    org: 'Example Org',
    as: 'AS29465 MTN NIGERIA Communication limited',
    asname: 'MTN-NG',
    mobile: false,
    proxy: false,
    hosting: false,
    // ignored extras
    extraJunk: true,
  };

  it('maps every listed field with transforms', () => {
    const m = mapIpApiResponse(raw);
    expect(m).toEqual({
      ip: '1.2.3.4',
      country: 'Nigeria',
      countryCode: 'NG',
      city: 'Lagos',
      region: 'Lagos',
      latitude: 6.5244,
      longitude: 3.3792,
      timezone: 'Africa/Lagos',
      currency: 'NGN', // uppercase
      isp: 'Example ISP',
      organization: 'Example Org',
      asn: 'AS29465', // leading AS#### token
      asnName: 'MTN-NG',
      isMobile: false,
      isProxy: false,
      isHosting: false,
      networkType: 'residential',
      confidence: 1, // 0.5 + 0.2 geo + 0.2 asn + 0.1 flags
    });
  });

  it('maps missing optionals to null', () => {
    const m = mapIpApiResponse({
      status: 'success',
      query: '9.9.9.9',
    });
    expect(m.country).toBeNull();
    expect(m.city).toBeNull();
    expect(m.asn).toBeNull();
    expect(m.networkType).toBe('unknown');
    expect(m.confidence).toBe(0.5);
  });

  it('throws UPSTREAM_ERROR when status !== success', () => {
    expect(() =>
      mapIpApiResponse({ status: 'fail', message: 'reserved range' }),
    ).toThrow(AppError);
    try {
      mapIpApiResponse({ status: 'fail', message: 'reserved range' });
    } catch (err) {
      expect(err).toMatchObject({ code: 'UPSTREAM_ERROR', message: 'reserved range' });
    }
  });
});

describe('Section 12.2 ipwho.is → IpIntelligence', () => {
  const raw = {
    success: true,
    ip: '8.8.8.8',
    country: 'United States',
    country_code: 'US',
    city: 'Mountain View',
    region: 'California',
    latitude: 37.386,
    longitude: -122.0838,
    timezone: { id: 'America/Los_Angeles' },
    currency: { code: 'usd' },
    connection: { isp: 'Google LLC', org: 'Google Public DNS', asn: 15169 },
    ignored: { foo: 1 },
  };

  it('maps nested fields; flags always null; asnName from connection.isp', () => {
    const m = mapIpWhoResponse(raw);
    expect(m).toMatchObject({
      ip: '8.8.8.8',
      country: 'United States',
      countryCode: 'US',
      city: 'Mountain View',
      region: 'California',
      latitude: 37.386,
      longitude: -122.0838,
      timezone: 'America/Los_Angeles',
      currency: 'USD',
      isp: 'Google LLC',
      organization: 'Google Public DNS',
      asn: 'AS15169',
      asnName: 'Google LLC',
      isProxy: null,
      isHosting: null,
      isMobile: null,
      networkType: 'unknown',
    });
    // 0.5 + 0.2 (geo) + 0.2 (asn) — no flag bonus
    expect(m.confidence).toBe(0.9);
  });

  it('prefixes AS when asn is numeric string', () => {
    expect(formatAsn('15169')).toBe('AS15169');
    expect(formatAsn('AS99')).toBe('AS99');
  });

  it('throws UPSTREAM_ERROR when success === false', () => {
    expect(() => mapIpWhoResponse({ success: false, message: 'Invalid IP' })).toThrow(
      AppError,
    );
  });
});

describe('Section 12.3 CoinGecko → Coin / TrendingCoin', () => {
  it('maps /coins/markets item with uppercase symbol and vs currency', () => {
    const coin = mapCoinGeckoMarket(
      {
        id: 'bitcoin',
        symbol: 'btc',
        name: 'Bitcoin',
        image: 'https://example.com/btc.png',
        current_price: 60000,
        market_cap: 1e12,
        market_cap_rank: 1,
        price_change_percentage_24h: 2.5,
        total_volume: 1e9,
        high_24h: 61000,
        low_24h: 59000,
        last_updated: '2026-07-16T12:00:00.000Z',
      },
      'EUR',
    );
    expect(coin).toEqual({
      id: 'bitcoin',
      symbol: 'BTC',
      name: 'Bitcoin',
      image: 'https://example.com/btc.png',
      currentPrice: 60000,
      currency: 'eur',
      marketCap: 1e12,
      marketCapRank: 1,
      priceChangePct24h: 2.5,
      totalVolume: 1e9,
      high24h: 61000,
      low24h: 59000,
      lastUpdated: '2026-07-16T12:00:00.000Z',
    });
  });

  it('maps missing optional market fields to null', () => {
    const coin = mapCoinGeckoMarket(
      {
        id: 'x',
        symbol: 'x',
        name: 'X',
        current_price: 1,
      },
      'usd',
    );
    expect(coin.image).toBeNull();
    expect(coin.marketCap).toBeNull();
    expect(coin.marketCapRank).toBeNull();
    expect(coin.priceChangePct24h).toBeNull();
    expect(coin.totalVolume).toBeNull();
    expect(coin.high24h).toBeNull();
    expect(coin.low24h).toBeNull();
  });

  it('maps /search/trending coins[].item → TrendingCoin', () => {
    expect(
      mapCoinGeckoTrendingItem({
        item: {
          id: 'solana',
          name: 'Solana',
          symbol: 'sol',
          market_cap_rank: 5,
          thumb: 'https://example.com/t.png',
        },
      }),
    ).toEqual({
      id: 'solana',
      name: 'Solana',
      symbol: 'SOL',
      marketCapRank: 5,
      thumb: 'https://example.com/t.png',
    });
  });

  it('ranks gainers/losers by priceChangePct24h', () => {
    const coins = [
      mapCoinGeckoMarket(
        { id: 'up', symbol: 'u', name: 'U', current_price: 1, price_change_percentage_24h: 10 },
        'usd',
      ),
      mapCoinGeckoMarket(
        { id: 'down', symbol: 'd', name: 'D', current_price: 1, price_change_percentage_24h: -8 },
        'usd',
      ),
      mapCoinGeckoMarket(
        { id: 'flat', symbol: 'f', name: 'F', current_price: 1, price_change_percentage_24h: null },
        'usd',
      ),
    ];
    const { gainers, losers } = pickGainersLosers(coins);
    expect(gainers[0]?.id).toBe('up');
    expect(losers[0]?.id).toBe('down');
    expect(gainers.map((c) => c.id)).not.toContain('flat');
  });
});

describe('Section 12.4 networkType + confidence', () => {
  it('applies priority: mobile → datacenter → proxy_vpn → residential → unknown', () => {
    expect(
      deriveNetworkType({ isMobile: true, isHosting: true, isProxy: true }),
    ).toBe('mobile');
    expect(
      deriveNetworkType({ isMobile: false, isHosting: true, isProxy: true }),
    ).toBe('datacenter');
    expect(
      deriveNetworkType({ isMobile: false, isHosting: false, isProxy: true }),
    ).toBe('proxy_vpn');
    expect(
      deriveNetworkType({ isMobile: false, isHosting: false, isProxy: false }),
    ).toBe('residential');
    expect(
      deriveNetworkType({ isMobile: null, isHosting: false, isProxy: false }),
    ).toBe('unknown');
  });

  it('scores confidence per plan formula', () => {
    expect(
      deriveConfidence({
        country: null,
        city: null,
        asn: null,
        isProxy: null,
        isHosting: null,
        isMobile: null,
      }),
    ).toBe(0.5);
    expect(
      deriveConfidence({
        country: 'US',
        city: 'NYC',
        asn: null,
        isProxy: null,
        isHosting: null,
        isMobile: null,
      }),
    ).toBe(0.7);
    expect(
      deriveConfidence({
        country: 'US',
        city: 'NYC',
        asn: 'AS1',
        isProxy: null,
        isHosting: null,
        isMobile: null,
      }),
    ).toBe(0.9);
    expect(
      deriveConfidence({
        country: 'US',
        city: 'NYC',
        asn: 'AS1',
        isProxy: false,
        isHosting: false,
        isMobile: false,
      }),
    ).toBe(1);
  });

  it('parseAsn takes leading AS#### token only', () => {
    expect(parseAsn('AS15169 Google LLC')).toBe('AS15169');
    expect(parseAsn(null)).toBeNull();
    expect(parseAsn('not-an-asn')).toBeNull();
  });
});

describe('Section 12.5 CryptoPanic → NewsItem', () => {
  it('maps results[] fields; imageUrl always null; sentiment from votes', () => {
    expect(
      mapCryptoPanicPost({
        title: 'Headline',
        url: 'https://example.com/a',
        published_at: '2026-07-16T10:00:00Z',
        source: { title: 'CoinDesk' },
        votes: { positive: 5, negative: 1 },
      }),
    ).toEqual({
      title: 'Headline',
      url: 'https://example.com/a',
      source: 'CoinDesk',
      publishedAt: '2026-07-16T10:00:00Z',
      sentiment: 'positive',
      imageUrl: null,
    });
  });

  it('derives sentiment positive / negative / neutral; null when votes absent', () => {
    expect(deriveSentimentFromVotes({ positive: 3, negative: 1 })).toBe('positive');
    expect(deriveSentimentFromVotes({ positive: 1, negative: 4 })).toBe('negative');
    expect(deriveSentimentFromVotes({ positive: 2, negative: 2 })).toBe('neutral');
    expect(deriveSentimentFromVotes(null)).toBeNull();
  });
});

describe('Section 12.6 GNews → NewsItem', () => {
  it('maps articles[]; sentiment always null; image → imageUrl', () => {
    expect(
      mapGNewsArticle({
        title: 'Regional',
        url: 'https://example.com/g',
        publishedAt: '2026-07-16T08:00:00Z',
        image: 'https://example.com/img.png',
        source: { name: 'Local News' },
      }),
    ).toEqual({
      title: 'Regional',
      url: 'https://example.com/g',
      source: 'Local News',
      publishedAt: '2026-07-16T08:00:00Z',
      sentiment: null,
      imageUrl: 'https://example.com/img.png',
    });
  });

  it('maps missing image to null', () => {
    expect(
      mapGNewsArticle({
        title: 'No image',
        url: 'https://example.com/n',
      }).imageUrl,
    ).toBeNull();
  });
});
