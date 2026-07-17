import { z } from 'zod';

import { HTTP_TIMEOUT_NEWS_MS } from '../../config/constants.js';
import { env } from '../../config/env.js';
import { AppError } from '../../lib/errors.js';
import { createHttpClient } from '../../lib/httpClient.js';
import type { NewsItem } from '../../types/domain.js';
import type { NewsProvider } from '../types.js';

const voteCountSchema = z.union([z.string(), z.number()]).nullable().optional();

const articleSchema = z.object({
  title: z.string(),
  url: z.string(),
  published_on: z.number().nullable().optional(),
  imageurl: z.string().nullable().optional(),
  source: z.string().nullable().optional(),
  source_info: z
    .object({
      name: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  upvotes: voteCountSchema,
  downvotes: voteCountSchema,
});

export function toVoteCount(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function deriveSentimentFromVotes(
  upvotes: number,
  downvotes: number,
): NewsItem['sentiment'] {
  if (upvotes === 0 && downvotes === 0) return null;
  if (upvotes > downvotes) return 'positive';
  if (downvotes > upvotes) return 'negative';
  return 'neutral';
}

export function mapCryptoCompareArticle(raw: unknown): NewsItem {
  const parsed = articleSchema.safeParse(raw);
  if (!parsed.success) {
    throw AppError.upstreamError('Invalid CryptoCompare article', parsed.error.issues);
  }
  const d = parsed.data;
  return {
    title: d.title,
    url: d.url,
    source: d.source_info?.name ?? d.source ?? null,
    publishedAt: d.published_on
      ? new Date(d.published_on * 1000).toISOString()
      : new Date().toISOString(),
    sentiment: deriveSentimentFromVotes(toVoteCount(d.upvotes), toVoteCount(d.downvotes)),
    imageUrl: d.imageurl ?? null,
  };
}

function isRateLimited(record: Record<string, unknown>): boolean {
  if (record.Type === 99) return true;
  return (
    typeof record.Message === 'string' && /rate limit/i.test(record.Message)
  );
}

/**
 * CryptoCompare success: `Data` is an article array.
 * Auth / rate-limit / bad filter: `Data` is `{}` (object), often with `Err` or `Type: 99`.
 */
export function extractCryptoCompareArticles(body: unknown): unknown[] {
  if (!body || typeof body !== 'object') {
    throw AppError.upstreamError('Invalid CryptoCompare response', { body });
  }

  const record = body as Record<string, unknown>;

  if (record.Err) {
    const err = record.Err as { message?: string };
    throw AppError.upstreamError(err.message ?? 'CryptoCompare error', record.Err);
  }

  if (record.Response === 'Error' || isRateLimited(record)) {
    throw AppError.upstreamError(
      typeof record.Message === 'string'
        ? record.Message
        : 'CryptoCompare returned an error response',
      { type: record.Type, message: record.Message },
    );
  }

  const data = record.Data;

  if (Array.isArray(data)) {
    return data;
  }

  // Empty object without Err/Type 99 — treat as no articles (bad category filter, etc.).
  if (data && typeof data === 'object' && Object.keys(data as object).length === 0) {
    return [];
  }

  throw AppError.upstreamError('Invalid CryptoCompare response', {
    expected: 'Data array',
    received: data === null || data === undefined ? String(data) : typeof data,
  });
}

/** CryptoCompare primary news provider. */
export class CryptoCompareProvider implements NewsProvider {
  readonly name = 'cryptocompare';
  private readonly client = createHttpClient({
    name: this.name,
    timeoutMs: HTTP_TIMEOUT_NEWS_MS,
  });

  async getNews(params: {
    country?: string;
    symbols?: string[];
    lang?: string;
  }): Promise<NewsItem[]> {
    // Prefer unfiltered feed — category filters return Data:{} for unknown/pipe values
    // and burn rate-limit credits. Filter client-side when symbols are provided.
    const res = await this.client.get<unknown>('https://min-api.cryptocompare.com/data/v2/news/', {
      headers: {
        Authorization: `Apikey ${env.CRYPTOCOMPARE_API_KEY}`,
      },
      params: {
        lang: (params.lang ?? 'en').toUpperCase(),
      },
    });

    let articles = extractCryptoCompareArticles(res.data);

    const symbols =
      params.symbols && params.symbols.length > 0
        ? params.symbols.map((s) => s.toUpperCase())
        : null;

    if (symbols) {
      const filtered = articles.filter((raw) => {
        if (!raw || typeof raw !== 'object') return false;
        const categories = String((raw as { categories?: unknown }).categories ?? '').toUpperCase();
        return symbols.some((symbol) => categories.includes(symbol));
      });
      // Keep unfiltered results if the symbol tags match nothing (still useful headlines).
      if (filtered.length > 0) {
        articles = filtered;
      }
    }

    return articles.map((article) => mapCryptoCompareArticle(article));
  }
}
