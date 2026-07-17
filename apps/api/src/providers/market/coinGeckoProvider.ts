import { z } from 'zod';

import { HTTP_TIMEOUT_MS } from '../../config/constants.js';
import { env } from '../../config/env.js';
import { AppError } from '../../lib/errors.js';
import { createHttpClient } from '../../lib/httpClient.js';
import type { Coin, TrendingCoin } from '../../types/domain.js';
import type { MarketProvider } from '../types.js';

const coinMarketSchema = z.object({
  id: z.string(),
  symbol: z.string(),
  name: z.string(),
  image: z.string().nullable().optional(),
  current_price: z.number().nullable().optional(),
  market_cap: z.number().nullable().optional(),
  market_cap_rank: z.number().nullable().optional(),
  price_change_percentage_24h: z.number().nullable().optional(),
  total_volume: z.number().nullable().optional(),
  high_24h: z.number().nullable().optional(),
  low_24h: z.number().nullable().optional(),
  last_updated: z.string().nullable().optional(),
});

const trendingItemSchema = z.object({
  item: z.object({
    id: z.string(),
    name: z.string(),
    symbol: z.string(),
    market_cap_rank: z.number().nullable().optional(),
    thumb: z.string().nullable().optional(),
  }),
});

const trendingResponseSchema = z.object({
  coins: z.array(trendingItemSchema).default([]),
});

export function mapCoinGeckoMarket(raw: unknown, vs: string): Coin {
  // Section 12.3 — /coins/markets item → Coin (symbol uppercased; currency from vs)
  const parsed = coinMarketSchema.safeParse(raw);
  if (!parsed.success) {
    throw AppError.upstreamError('Invalid CoinGecko market item', parsed.error.issues);
  }
  const d = parsed.data;
  if (d.current_price === null || d.current_price === undefined) {
    throw AppError.upstreamError('CoinGecko market item missing current_price');
  }
  return {
    id: d.id,
    symbol: d.symbol.toUpperCase(),
    name: d.name,
    image: d.image ?? null,
    currentPrice: d.current_price,
    currency: vs.toLowerCase(),
    marketCap: d.market_cap ?? null,
    marketCapRank: d.market_cap_rank ?? null,
    priceChangePct24h: d.price_change_percentage_24h ?? null,
    totalVolume: d.total_volume ?? null,
    high24h: d.high_24h ?? null,
    low24h: d.low_24h ?? null,
    lastUpdated: d.last_updated ?? new Date().toISOString(),
  };
}

export function mapCoinGeckoTrendingItem(raw: unknown): TrendingCoin {
  // Section 12.3 — /search/trending coins[].item → TrendingCoin
  const parsed = trendingItemSchema.safeParse(raw);
  if (!parsed.success) {
    throw AppError.upstreamError('Invalid CoinGecko trending item', parsed.error.issues);
  }
  const item = parsed.data.item;
  return {
    id: item.id,
    name: item.name,
    symbol: item.symbol.toUpperCase(),
    marketCapRank: item.market_cap_rank ?? null,
    thumb: item.thumb ?? null,
  };
}

const GAINERS_LOSERS_COUNT = 7;

/** Sort helpers — null price changes sort last. */
export function pickGainersLosers(coins: Coin[]): { gainers: Coin[]; losers: Coin[] } {
  const withChange = coins.filter((c) => c.priceChangePct24h !== null);
  const gainers = [...withChange]
    .sort((a, b) => (b.priceChangePct24h ?? 0) - (a.priceChangePct24h ?? 0))
    .slice(0, GAINERS_LOSERS_COUNT);
  const losers = [...withChange]
    .sort((a, b) => (a.priceChangePct24h ?? 0) - (b.priceChangePct24h ?? 0))
    .slice(0, GAINERS_LOSERS_COUNT);
  return { gainers, losers };
}

/** Phase 8 — CoinGecko market provider. */
export class CoinGeckoProvider implements MarketProvider {
  readonly name = 'coingecko';
  private readonly client = createHttpClient({
    name: this.name,
    timeoutMs: HTTP_TIMEOUT_MS,
  });
  private readonly baseUrl: string;

  constructor(baseUrl = env.COINGECKO_BASE_URL) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  private headers(): Record<string, string> {
    if (env.COINGECKO_DEMO_KEY) {
      return { 'x-cg-demo-api-key': env.COINGECKO_DEMO_KEY };
    }
    return {};
  }

  async getMarkets(vs: string, limit: number): Promise<Coin[]> {
    const res = await this.client.get<unknown>(`${this.baseUrl}/coins/markets`, {
      headers: this.headers(),
      params: {
        vs_currency: vs.toLowerCase(),
        order: 'market_cap_desc',
        per_page: limit,
        page: 1,
        sparkline: false,
        price_change_percentage: '24h',
      },
    });

    if (!Array.isArray(res.data)) {
      throw AppError.upstreamError('CoinGecko markets response is not an array');
    }

    return res.data.map((item) => mapCoinGeckoMarket(item, vs));
  }

  /**
   * Phase 15 — `GET /coins/markets?vs_currency={vs}&ids={csv}`.
   * Returns only coins CoinGecko knows; missing ids are omitted (caller marks unavailable).
   */
  async getMarketsByIds(ids: string[], vs: string): Promise<Coin[]> {
    const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
    if (unique.length === 0) return [];

    const res = await this.client.get<unknown>(`${this.baseUrl}/coins/markets`, {
      headers: this.headers(),
      params: {
        vs_currency: vs.toLowerCase(),
        ids: unique.join(','),
        sparkline: false,
        price_change_percentage: '24h',
      },
    });

    if (!Array.isArray(res.data)) {
      throw AppError.upstreamError('CoinGecko markets-by-ids response is not an array');
    }

    return res.data.map((item) => mapCoinGeckoMarket(item, vs));
  }

  async getTrending(): Promise<TrendingCoin[]> {
    const res = await this.client.get<unknown>(`${this.baseUrl}/search/trending`, {
      headers: this.headers(),
    });
    const parsed = trendingResponseSchema.safeParse(res.data);
    if (!parsed.success) {
      throw AppError.upstreamError('Invalid CoinGecko trending response', parsed.error.issues);
    }
    return parsed.data.coins.map((c) => mapCoinGeckoTrendingItem(c));
  }
}
