import { http, HttpResponse } from 'msw';

/** Shared MSW fixtures for IP providers (Phase 7 / 17). */
export const ipApiSuccess = {
  status: 'success',
  query: '8.8.8.8',
  country: 'United States',
  countryCode: 'US',
  regionName: 'California',
  city: 'Mountain View',
  lat: 37.386,
  lon: -122.0838,
  timezone: 'America/Los_Angeles',
  currency: 'USD',
  isp: 'Google LLC',
  org: 'Google Public DNS',
  as: 'AS15169 Google LLC',
  asname: 'GOOGLE',
  mobile: false,
  proxy: false,
  hosting: true,
};

export const ipWhoSuccess = {
  success: true,
  ip: '8.8.8.8',
  country: 'United States',
  country_code: 'US',
  city: 'Mountain View',
  region: 'California',
  latitude: 37.386,
  longitude: -122.0838,
  timezone: { id: 'America/Los_Angeles' },
  currency: { code: 'USD' },
  connection: { isp: 'Google LLC', org: 'Google Public DNS', asn: 15169 },
};

export function makeMarketCoin(
  overrides: Partial<{
    id: string;
    symbol: string;
    name: string;
    current_price: number;
    price_change_percentage_24h: number;
    market_cap_rank: number;
  }> = {},
) {
  const id = overrides.id ?? 'bitcoin';
  return {
    id,
    symbol: overrides.symbol ?? id.slice(0, 3),
    name: overrides.name ?? id,
    image: `https://example.com/${id}.png`,
    current_price: overrides.current_price ?? 100,
    market_cap: 1_000_000,
    market_cap_rank: overrides.market_cap_rank ?? 1,
    price_change_percentage_24h: overrides.price_change_percentage_24h ?? 1,
    total_volume: 50_000,
    high_24h: 110,
    low_24h: 90,
    last_updated: '2026-07-16T12:00:00.000Z',
  };
}

export const coinGeckoMarketsFixture = [
  makeMarketCoin({ id: 'bitcoin', symbol: 'btc', name: 'Bitcoin', current_price: 60000, price_change_percentage_24h: 2, market_cap_rank: 1 }),
  makeMarketCoin({ id: 'ethereum', symbol: 'eth', name: 'Ethereum', current_price: 3000, price_change_percentage_24h: 5, market_cap_rank: 2 }),
  makeMarketCoin({ id: 'solana', symbol: 'sol', name: 'Solana', current_price: 150, price_change_percentage_24h: -3, market_cap_rank: 5 }),
  makeMarketCoin({ id: 'ripple', symbol: 'xrp', name: 'XRP', current_price: 0.5, price_change_percentage_24h: -8, market_cap_rank: 4 }),
  makeMarketCoin({ id: 'cardano', symbol: 'ada', name: 'Cardano', current_price: 0.4, price_change_percentage_24h: 12, market_cap_rank: 8 }),
  makeMarketCoin({ id: 'dogecoin', symbol: 'doge', name: 'Dogecoin', current_price: 0.1, price_change_percentage_24h: -1, market_cap_rank: 9 }),
  makeMarketCoin({ id: 'polkadot', symbol: 'dot', name: 'Polkadot', current_price: 6, price_change_percentage_24h: 8, market_cap_rank: 12 }),
  makeMarketCoin({ id: 'avalanche-2', symbol: 'avax', name: 'Avalanche', current_price: 30, price_change_percentage_24h: -5, market_cap_rank: 11 }),
];

export const coinGeckoTrendingFixture = {
  coins: [
    {
      item: {
        id: 'bitcoin',
        name: 'Bitcoin',
        symbol: 'btc',
        market_cap_rank: 1,
        thumb: 'https://example.com/btc-thumb.png',
      },
    },
    {
      item: {
        id: 'ethereum',
        name: 'Ethereum',
        symbol: 'eth',
        market_cap_rank: 2,
        thumb: 'https://example.com/eth-thumb.png',
      },
    },
  ],
};

export const ipProviderHandlers = [
  http.get('http://ip-api.com/json/:ip', ({ params }) => {
    return HttpResponse.json({ ...ipApiSuccess, query: String(params.ip) });
  }),
  http.get('https://ipwho.is/:ip', ({ params }) => {
    return HttpResponse.json({ ...ipWhoSuccess, ip: String(params.ip) });
  }),
];

export const coinGeckoHandlers = [
  http.get('https://api.coingecko.com/api/v3/coins/markets', ({ request }) => {
    const url = new URL(request.url);
    const perPage = Number(url.searchParams.get('per_page') ?? '20');
    return HttpResponse.json(coinGeckoMarketsFixture.slice(0, perPage));
  }),
  http.get('https://api.coingecko.com/api/v3/search/trending', () => {
    return HttpResponse.json(coinGeckoTrendingFixture);
  }),
];

export const cryptoPanicFixture = {
  results: [
    {
      title: 'Bitcoin hits new high',
      url: 'https://example.com/btc',
      published_at: '2026-07-16T10:00:00Z',
      source: { title: 'CoinDesk' },
      votes: { positive: 10, negative: 2 },
    },
    {
      title: 'ETH update',
      url: 'https://example.com/eth',
      published_at: '2026-07-16T09:00:00Z',
      source: { title: 'The Block' },
      votes: { positive: 1, negative: 5 },
    },
  ],
};

export const gNewsFixture = {
  articles: [
    {
      title: 'Regional crypto news',
      url: 'https://example.com/gnews',
      publishedAt: '2026-07-16T08:00:00Z',
      image: 'https://example.com/img.png',
      source: { name: 'Local News' },
    },
  ],
};

export const newsHandlers = [
  http.get('https://cryptopanic.com/api/v1/posts/', () => {
    return HttpResponse.json(cryptoPanicFixture);
  }),
  http.get('https://gnews.io/api/v4/search', () => {
    return HttpResponse.json(gNewsFixture);
  }),
];
