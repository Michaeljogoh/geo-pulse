import { MARKET_DEFAULT_LIMIT } from '../config/constants.js';
import type {
  Coin,
  DashboardPayload,
  IpIntelligence,
  NewsItem,
  SectionMeta,
  TrendingResult,
} from '../types/domain.js';
import type { CacheSource } from '../cache/types.js';
import { getGeo } from './geoService.js';
import { getMarket, getTrending } from './marketService.js';
import { getNews } from './newsService.js';

function emptyTrending(): TrendingResult {
  return { trending: [], gainers: [], losers: [] };
}

function unknownVisitor(ip: string): IpIntelligence {
  return {
    ip,
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
    confidence: 0,
  };
}

async function timedSettled<T>(
  fn: () => Promise<T>,
): Promise<{ settled: PromiseSettledResult<T>; latencyMs: number }> {
  const started = Date.now();
  try {
    const value = await fn();
    return { settled: { status: 'fulfilled', value }, latencyMs: Date.now() - started };
  } catch (reason) {
    return { settled: { status: 'rejected', reason }, latencyMs: Date.now() - started };
  }
}

function sectionFromSettled<T>(
  settled: PromiseSettledResult<T>,
  latencyMs: number,
  pick: (value: T) => { source: CacheSource },
): { ok: boolean; meta: SectionMeta; value: T | null } {
  if (settled.status === 'fulfilled') {
    const { source } = pick(settled.value);
    return {
      ok: true,
      value: settled.value,
      meta: {
        ok: true,
        source,
        latencyMs,
        error: null,
      },
    };
  }
  const message =
    settled.reason instanceof Error ? settled.reason.message : 'Section request failed';
  return {
    ok: false,
    value: null,
    meta: {
      ok: false,
      source: 'error',
      latencyMs,
      error: message,
    },
  };
}

/**
 * Section 9.6 / Phase 10 — geo first, then market/trending/news in parallel.
 * Always resolves a payload; partial failures set degraded=true.
 */
export async function getDashboard(ip: string): Promise<DashboardPayload> {
  let visitor = unknownVisitor(ip);
  let geoFailed = false;

  try {
    const geo = await getGeo(ip);
    visitor = geo.value;
  } catch {
    geoFailed = true;
    visitor = unknownVisitor(ip);
  }

  const vs = (visitor.currency ?? 'USD').toLowerCase();
  const country = visitor.countryCode ?? undefined;

  const [marketTimed, trendingTimed, newsTimed] = await Promise.all([
    timedSettled(() => getMarket(vs, MARKET_DEFAULT_LIMIT)),
    timedSettled(() => getTrending(vs)),
    timedSettled(() => getNews({ country, lang: 'en' })),
  ]);

  const marketSection = sectionFromSettled(marketTimed.settled, marketTimed.latencyMs, (v) => ({
    source: v.source,
  }));
  const trendingSection = sectionFromSettled(
    trendingTimed.settled,
    trendingTimed.latencyMs,
    (v) => ({ source: v.source }),
  );
  const newsSection = sectionFromSettled(newsTimed.settled, newsTimed.latencyMs, (v) => ({
    source: v.source,
  }));

  const market: Coin[] =
    marketSection.ok && marketSection.value ? marketSection.value.value : [];
  const trending: TrendingResult =
    trendingSection.ok && trendingSection.value
      ? trendingSection.value.value
      : emptyTrending();
  const news: NewsItem[] =
    newsSection.ok && newsSection.value ? newsSection.value.value : [];

  const degraded =
    geoFailed || !marketSection.ok || !trendingSection.ok || !newsSection.ok;

  return {
    visitor,
    market,
    trending,
    news,
    sections: {
      market: marketSection.meta,
      trending: trendingSection.meta,
      news: newsSection.meta,
    },
    degraded,
  };
}
