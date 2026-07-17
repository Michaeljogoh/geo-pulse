import type { Coin, IpIntelligence, NewsItem, TrendingCoin } from '../types/domain.js';

/** Phase 7+ — provider interfaces (Dependency Inversion). */

export interface IpIntelligenceProvider {
  readonly name: string;
  lookup(ip: string): Promise<IpIntelligence>;
}

export interface MarketProvider {
  readonly name: string;
  getMarkets(vs: string, limit: number): Promise<Coin[]>;
  getTrending(): Promise<TrendingCoin[]>;
  /** Phase 15 — fetch specific coins by CoinGecko ids. */
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
