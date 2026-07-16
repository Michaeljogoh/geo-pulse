import { describe, expect, it } from 'vitest';

import type {
  AuthUser,
  Coin,
  DashboardPayload,
  IpIntelligence,
  NewsItem,
  WatchlistItem,
} from '../../src/types/domain.js';
import type { ApiResponse, ErrorCode } from '../../src/types/envelope.js';

describe('domain + envelope types (Sections 6–7)', () => {
  it('shapes a successful IpIntelligence envelope', () => {
    const data: IpIntelligence = {
      ip: '8.8.8.8',
      country: 'United States',
      countryCode: 'US',
      city: null,
      region: null,
      latitude: null,
      longitude: null,
      timezone: null,
      currency: 'USD',
      isp: null,
      organization: null,
      asn: null,
      asnName: null,
      isProxy: false,
      isHosting: true,
      isMobile: false,
      networkType: 'datacenter',
      confidence: 0.9,
    };

    const body: ApiResponse<IpIntelligence> = {
      data,
      meta: {
        requestId: 'b1f...',
        source: 'live',
        provider: 'ipapi',
        latencyMs: 42,
        cached: false,
        confidence: 0.9,
      },
      error: null,
    };

    expect(body.data?.networkType).toBe('datacenter');
    expect(body.error).toBeNull();
  });

  it('shapes a VALIDATION_ERROR envelope', () => {
    const code: ErrorCode = 'VALIDATION_ERROR';
    const body: ApiResponse<null> = {
      data: null,
      meta: {
        requestId: 'b1f...',
        source: 'live',
        latencyMs: 3,
        cached: false,
      },
      error: {
        code,
        message: 'Invalid query parameter: vs',
        details: [{ path: 'vs', issue: 'must be a 3-letter code' }],
      },
    };

    expect(body.data).toBeNull();
    expect(body.error?.code).toBe('VALIDATION_ERROR');
  });

  it('includes AuthUser and WatchlistItem domain shapes', () => {
    const user: AuthUser = {
      uid: 'uid-1',
      email: 'a@b.com',
      name: 'Ada',
      picture: null,
    };
    const coin: Coin = {
      id: 'bitcoin',
      symbol: 'BTC',
      name: 'Bitcoin',
      image: null,
      currentPrice: 1,
      currency: 'usd',
      marketCap: null,
      marketCapRank: 1,
      priceChangePct24h: null,
      totalVolume: null,
      high24h: null,
      low24h: null,
      lastUpdated: new Date().toISOString(),
    };
    const item: WatchlistItem = {
      coinId: 'bitcoin',
      available: true,
      coin,
      addedAt: new Date().toISOString(),
    };
    const news: NewsItem = {
      title: 't',
      url: 'https://example.com',
      source: null,
      publishedAt: new Date().toISOString(),
      sentiment: null,
      imageUrl: null,
    };
    const dashboard: DashboardPayload = {
      visitor: {
        ip: '1.1.1.1',
        country: null,
        countryCode: null,
        city: null,
        region: null,
        latitude: null,
        longitude: null,
        timezone: null,
        currency: null,
        isp: null,
        organization: null,
        asn: null,
        asnName: null,
        isProxy: null,
        isHosting: null,
        isMobile: null,
        networkType: 'unknown',
        confidence: 0.5,
      },
      market: [coin],
      trending: { trending: [], gainers: [], losers: [] },
      news: [news],
      sections: {
        market: { ok: true, source: 'live', latencyMs: 1, error: null },
        trending: { ok: true, source: 'live', latencyMs: 1, error: null },
        news: { ok: true, source: 'live', latencyMs: 1, error: null },
      },
      degraded: false,
    };

    expect(user.uid).toBe('uid-1');
    expect(item.available).toBe(true);
    expect(dashboard.degraded).toBe(false);
  });
});
