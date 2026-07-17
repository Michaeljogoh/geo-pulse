import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import type { NewsItem } from '../../types/domain.js';
import { withResilience } from '../withResilience.js';
import { CryptoPanicProvider } from './cryptoPanicProvider.js';
import { GNewsProvider } from './gNewsProvider.js';

export interface NewsQueryParams {
  country?: string;
  symbols?: string[];
  lang?: string;
}

export interface FetchNewsOptions {
  /** Override whether GNews fallback is available (defaults to env.GNEWS_API_KEY). */
  gnewsEnabled?: boolean;
}

/**
 * Phase 9 — CryptoPanic primary → GNews fallback (when enabled on failure/empty).
 * Missing GNews → CryptoPanic-only (empty list OK; errors propagate).
 */
export async function fetchNews(
  params: NewsQueryParams,
  options: FetchNewsOptions = {},
): Promise<{
  items: NewsItem[];
  provider: string;
}> {
  const gnewsEnabled = options.gnewsEnabled ?? Boolean(env.GNEWS_API_KEY);
  const primary = new CryptoPanicProvider();
  let primaryError: unknown;
  let emptyFromPrimary = false;

  try {
    const wrapped = await withResilience(primary.name, () => primary.getNews(params));
    if (wrapped.result.length > 0) {
      return { items: wrapped.result, provider: wrapped.provider };
    }
    emptyFromPrimary = true;
    logger.warn({ provider: primary.name }, 'CryptoPanic returned empty; considering GNews fallback');
  } catch (err) {
    primaryError = err;
    logger.warn({ err, provider: primary.name }, 'CryptoPanic failed; considering GNews fallback');
  }

  if (gnewsEnabled) {
    const fallback = new GNewsProvider();
    const wrapped = await withResilience(fallback.name, () => fallback.getNews(params));
    return { items: wrapped.result, provider: wrapped.provider };
  }

  if (emptyFromPrimary) {
    return { items: [], provider: primary.name };
  }

  throw primaryError;
}

export async function getNews(params: NewsQueryParams): Promise<{
  items: NewsItem[];
  provider: string;
}> {
  return fetchNews(params);
}

export function getNewsProvider(): CryptoPanicProvider {
  return new CryptoPanicProvider();
}
