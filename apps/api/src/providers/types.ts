import type { Coin, IpIntelligence, NewsItem, TrendingCoin } from '../types/domain.js';

/** Upstream provider contracts used by services. */

export interface IpIntelligenceProvider {
  readonly name: string;
  lookup(ip: string): Promise<IpIntelligence>;
}

export interface MarketProvider {
  readonly name: string;
  getMarkets(vs: string, limit: number): Promise<Coin[]>;
  getTrending(): Promise<TrendingCoin[]>;
  /** Fetch specific coins by CoinGecko ids. */
  getMarketsByIds(ids: string[], vs: string): Promise<Coin[]>;
}

export interface NewsProvider {
  readonly name: string;
  getNews(params: {
    country?: string;
    symbols?: string[];
    lang?: string;
  }): Promise<NewsItem[]>;
}
