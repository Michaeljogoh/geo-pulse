import { z } from 'zod';

import { HTTP_TIMEOUT_NEWS_MS } from '../../config/constants.js';
import { env } from '../../config/env.js';
import { AppError } from '../../lib/errors.js';
import { createHttpClient } from '../../lib/httpClient.js';
import type { NewsItem } from '../../types/domain.js';
import type { NewsProvider } from '../types.js';

const articleSchema = z.object({
  title: z.string(),
  url: z.string(),
  publishedAt: z.string().nullable().optional(),
  image: z.string().nullable().optional(),
  source: z
    .object({
      name: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
});

const responseSchema = z.object({
  articles: z.array(articleSchema).default([]),
});

export function mapGNewsArticle(raw: unknown): NewsItem {
  // Section 12.6 — articles[] → NewsItem; sentiment always null; image → imageUrl
  const parsed = articleSchema.safeParse(raw);
  if (!parsed.success) {
    throw AppError.upstreamError('Invalid GNews article', parsed.error.issues);
  }
  const d = parsed.data;
  return {
    title: d.title,
    url: d.url,
    source: d.source?.name ?? null,
    publishedAt: d.publishedAt ?? new Date().toISOString(),
    sentiment: null,
    imageUrl: d.image ?? null,
  };
}

/** Phase 9 — GNews regional fallback provider. */
export class GNewsProvider implements NewsProvider {
  readonly name = 'gnews';
  private readonly client = createHttpClient({
    name: this.name,
    timeoutMs: HTTP_TIMEOUT_NEWS_MS,
  });

  async getNews(params: {
    country?: string;
    symbols?: string[];
    lang?: string;
  }): Promise<NewsItem[]> {
    if (!env.GNEWS_API_KEY) {
      throw AppError.upstreamError('GNews API key is not configured');
    }

    const res = await this.client.get<unknown>('https://gnews.io/api/v4/search', {
      params: {
        q: 'crypto',
        lang: params.lang ?? 'en',
        ...(params.country ? { country: params.country.toLowerCase() } : {}),
        max: 10,
        apikey: env.GNEWS_API_KEY,
      },
    });

    const parsed = responseSchema.safeParse(res.data);
    if (!parsed.success) {
      throw AppError.upstreamError('Invalid GNews response', parsed.error.issues);
    }

    return parsed.data.articles.map((article) => mapGNewsArticle(article));
  }
}
