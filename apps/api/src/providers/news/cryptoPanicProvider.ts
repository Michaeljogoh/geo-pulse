import { z } from 'zod';

import { HTTP_TIMEOUT_NEWS_MS } from '../../config/constants.js';
import { env } from '../../config/env.js';
import { AppError } from '../../lib/errors.js';
import { createHttpClient } from '../../lib/httpClient.js';
import type { NewsItem } from '../../types/domain.js';
import type { NewsProvider } from '../types.js';

const postSchema = z.object({
  title: z.string(),
  url: z.string().nullable().optional(),
  published_at: z.string().nullable().optional(),
  source: z
    .object({
      title: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  votes: z
    .object({
      positive: z.number().optional(),
      negative: z.number().optional(),
      important: z.number().optional(),
    })
    .nullable()
    .optional(),
});

const responseSchema = z.object({
  results: z.array(postSchema).default([]),
});

export function deriveSentimentFromVotes(
  votes: { positive?: number; negative?: number } | null | undefined,
): NewsItem['sentiment'] {
  if (!votes) return null;
  const positive = votes.positive ?? 0;
  const negative = votes.negative ?? 0;
  if (positive === 0 && negative === 0) return null;
  if (positive > negative) return 'positive';
  if (negative > positive) return 'negative';
  return 'neutral';
}

export function mapCryptoPanicPost(raw: unknown): NewsItem {
  const parsed = postSchema.safeParse(raw);
  if (!parsed.success) {
    throw AppError.upstreamError('Invalid CryptoPanic post', parsed.error.issues);
  }
  const d = parsed.data;
  return {
    title: d.title,
    url: d.url ?? '',
    source: d.source?.title ?? null,
    publishedAt: d.published_at ?? new Date().toISOString(),
    sentiment: deriveSentimentFromVotes(d.votes),
    imageUrl: null,
  };
}

/** Phase 9 — CryptoPanic primary news provider. */
export class CryptoPanicProvider implements NewsProvider {
  readonly name = 'cryptopanic';
  private readonly client = createHttpClient({
    name: this.name,
    timeoutMs: HTTP_TIMEOUT_NEWS_MS,
  });

  async getNews(params: {
    country?: string;
    symbols?: string[];
    lang?: string;
  }): Promise<NewsItem[]> {
    const currencies =
      params.symbols && params.symbols.length > 0 ? params.symbols.join(',') : 'BTC,ETH';

    const res = await this.client.get<unknown>('https://cryptopanic.com/api/v1/posts/', {
      params: {
        auth_token: env.CRYPTOPANIC_TOKEN,
        public: true,
        currencies,
        kind: 'news',
      },
    });

    const parsed = responseSchema.safeParse(res.data);
    if (!parsed.success) {
      throw AppError.upstreamError('Invalid CryptoPanic response', parsed.error.issues);
    }

    return parsed.data.results.map((post) => mapCryptoPanicPost(post));
  }
}
