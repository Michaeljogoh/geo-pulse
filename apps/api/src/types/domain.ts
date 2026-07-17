/** Normalized domain types returned by the API. */

export type NetworkType = 'residential' | 'mobile' | 'datacenter' | 'proxy_vpn' | 'unknown';

export interface IpIntelligence {
  ip: string;
  country: string | null;
  countryCode: string | null; // ISO 3166-1 alpha-2
  city: string | null;
  region: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string | null; // IANA, e.g. "Africa/Lagos"
  currency: string | null; // ISO 4217, e.g. "NGN"
  isp: string | null;
  organization: string | null;
  asn: string | null; // e.g. "AS15169"
  asnName: string | null;
  isProxy: boolean | null; // null = provider could not determine
  isHosting: boolean | null; // datacenter
  isMobile: boolean | null;
  networkType: NetworkType;
  confidence: number; // 0..1
}

export interface Coin {
  id: string;
  symbol: string;
  name: string;
  image: string | null;
  currentPrice: number;
  currency: string; // vs_currency used
  marketCap: number | null;
  marketCapRank: number | null;
  priceChangePct24h: number | null;
  totalVolume: number | null;
  high24h: number | null;
  low24h: number | null;
  lastUpdated: string; // ISO 8601
}

export interface TrendingCoin {
  id: string;
  name: string;
  symbol: string;
  marketCapRank: number | null;
  thumb: string | null;
}

export interface TrendingResult {
  trending: TrendingCoin[];
  gainers: Coin[]; // top +priceChangePct24h
  losers: Coin[]; // top -priceChangePct24h
}

export interface NewsItem {
  title: string;
  url: string;
  source: string | null;
  publishedAt: string; // ISO 8601
  sentiment: 'positive' | 'negative' | 'neutral' | null;
  imageUrl: string | null;
}

export interface DashboardPayload {
  visitor: IpIntelligence;
  market: Coin[];
  trending: TrendingResult;
  news: NewsItem[];
  sections: {
    market: SectionMeta;
    trending: SectionMeta;
    news: SectionMeta;
  };
  degraded: boolean; // true if any section failed
}

export interface SectionMeta {
  ok: boolean;
  source: 'live' | 'cache-l1' | 'cache-l2' | 'fallback' | 'error';
  latencyMs: number;
  error: string | null;
}

// --- Auth & watchlist ---

export interface AuthUser {
  uid: string; // Firebase Auth uid (from verified ID token)
  email: string | null;
  name: string | null;
  picture: string | null; // avatar URL
}

export interface WatchlistItem {
  coinId: string; // CoinGecko id, e.g. "bitcoin"
  available: boolean; // false if the coin could not be priced
  coin: Coin | null; // enriched live price data (null when unavailable)
  addedAt: string; // ISO 8601
}

/** Provider health snapshot for GET /api/status. */
export interface ProviderHealth {
  provider: string;
  state: 'closed' | 'open' | 'half_open';
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  consecutiveFail: number;
  successCount: number;
  failureCount: number;
  avgLatencyMs: number;
}
