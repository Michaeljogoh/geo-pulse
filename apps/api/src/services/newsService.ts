import { cacheManager } from '../cache/cacheManager.js';
import type { CacheResult } from '../cache/types.js';
import { CACHE_TTL_NEWS_S } from '../config/constants.js';
import { fetchNews } from '../providers/news/index.js';
import type { NewsItem } from '../types/domain.js';

export interface NewsServiceParams {
  country?: string;
  symbols?: string[];
  lang?: string;
}

interface CachedNews {
  items: NewsItem[];
  provider: string;
}

function newsCacheKey(params: NewsServiceParams): string {
  const country = params.country?.toUpperCase() || 'any';
  const symbols =
    params.symbols && params.symbols.length > 0
      ? [...params.symbols].map((s) => s.toUpperCase()).sort().join(',')
      : 'any';
  const lang = params.lang || 'en';
  return `news:${country}:${symbols}:${lang}`;
}

/** Phase 9 — news service with Section 9.5 cache key. */
export async function getNews(
  params: NewsServiceParams,
): Promise<CacheResult<NewsItem[]> & { provider: string }> {
  const cached = await cacheManager.getOrSet<CachedNews>(
    newsCacheKey(params),
    CACHE_TTL_NEWS_S,
    async () => {
      const result = await fetchNews({
        country: params.country,
        symbols: params.symbols,
        lang: params.lang ?? 'en',
      });
      return { items: result.items, provider: result.provider };
    },
  );

  return {
    value: cached.value.items,
    source: cached.source,
    provider: cached.value.provider,
  };
}
