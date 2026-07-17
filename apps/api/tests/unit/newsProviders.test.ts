import { describe, expect, it } from 'vitest';

import { AppError } from '../../src/lib/errors.js';
import {
  deriveSentimentFromVotes,
  extractCryptoCompareArticles,
  mapCryptoCompareArticle,
  toVoteCount,
} from '../../src/providers/news/cryptoCompareProvider.js';
import { mapGNewsArticle } from '../../src/providers/news/gNewsProvider.js';
import { cryptoCompareFixture, gNewsFixture } from '../msw/handlers.js';

describe('News provider mappers (CryptoCompare / GNews)', () => {
  it('derives sentiment from upvotes / downvotes', () => {
    expect(deriveSentimentFromVotes(3, 1)).toBe('positive');
    expect(deriveSentimentFromVotes(1, 4)).toBe('negative');
    expect(deriveSentimentFromVotes(2, 2)).toBe('neutral');
    expect(deriveSentimentFromVotes(0, 0)).toBeNull();
  });

  it('coerces string and number vote counts', () => {
    expect(toVoteCount('10')).toBe(10);
    expect(toVoteCount(5)).toBe(5);
    expect(toVoteCount(null)).toBe(0);
    expect(toVoteCount('')).toBe(0);
  });

  it('maps CryptoCompare articles', () => {
    const first = cryptoCompareFixture.Data[0];
    const item = mapCryptoCompareArticle(first);
    expect(item).toMatchObject({
      title: 'Bitcoin hits new high',
      source: 'CoinDesk',
      sentiment: 'positive',
      imageUrl: 'https://example.com/btc.png',
      publishedAt: '2024-07-16T10:00:00.000Z',
    });
  });

  it('extracts articles from success payload', () => {
    expect(extractCryptoCompareArticles(cryptoCompareFixture)).toHaveLength(2);
  });

  it('treats empty Data object as no articles', () => {
    expect(extractCryptoCompareArticles({ Type: 100, Data: {} })).toEqual([]);
  });

  it('throws on rate-limit payload (Type 99 + Data object)', () => {
    expect(() =>
      extractCryptoCompareArticles({
        Type: 99,
        Message: 'You are over your rate limit please upgrade your account!',
        Data: {},
      }),
    ).toThrow(AppError);
  });

  it('throws when Err is present', () => {
    expect(() =>
      extractCryptoCompareArticles({
        Data: {},
        Err: { message: 'API key required' },
      }),
    ).toThrow(/API key required/);
  });

  it('maps GNews articles', () => {
    const first = gNewsFixture.articles[0];
    const item = mapGNewsArticle(first);
    expect(item).toMatchObject({
      title: 'Regional crypto news',
      source: 'Local News',
      sentiment: null,
      imageUrl: 'https://example.com/img.png',
    });
  });
});
