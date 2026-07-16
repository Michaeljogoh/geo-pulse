import type { CacheResult } from '../cache/types.js';
import type { NewsItem } from '../types/domain.js';

/** Phase 9 — news service. */
export async function getNews(_params: {
  country?: string;
  symbols?: string[];
  lang?: string;
}): Promise<CacheResult<NewsItem[]>> {
  throw Object.assign(new Error('Not implemented: newsService.getNews (Phase 9)'), {
    isUpstream: true,
  });
}
