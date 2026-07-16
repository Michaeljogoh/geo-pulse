export type NetworkType = 'residential' | 'mobile' | 'datacenter' | 'proxy_vpn' | 'unknown';

export interface IpIntelligence {
  ip: string;
  country: string | null;
  countryCode: string | null;
  city: string | null;
  region: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
  currency: string | null;
  isp: string | null;
  organization: string | null;
  asn: string | null;
  asnName: string | null;
  isProxy: boolean | null;
  isHosting: boolean | null;
  isMobile: boolean | null;
  networkType: NetworkType;
  confidence: number;
}

export interface Coin {
  id: string;
  symbol: string;
  name: string;
  image: string | null;
  currentPrice: number;
  currency: string;
  marketCap: number | null;
  marketCapRank: number | null;
  priceChangePct24h: number | null;
  totalVolume: number | null;
  high24h: number | null;
  low24h: number | null;
  lastUpdated: string;
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
  gainers: Coin[];
  losers: Coin[];
}

export interface NewsItem {
  title: string;
  url: string;
  source: string | null;
  publishedAt: string;
  sentiment: 'positive' | 'negative' | 'neutral' | null;
  imageUrl: string | null;
}

export interface SectionMeta {
  ok: boolean;
  source: 'live' | 'cache-l1' | 'cache-l2' | 'fallback' | 'error';
  latencyMs: number;
  error: string | null;
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
  degraded: boolean;
}
