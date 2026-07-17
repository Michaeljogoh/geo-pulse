import { describe, expect, it } from 'vitest';

import {
  deriveSentimentFromVotes,
  mapCryptoPanicPost,
} from '../../src/providers/news/cryptoPanicProvider.js';
import { mapGNewsArticle } from '../../src/providers/news/gNewsProvider.js';
import { cryptoPanicFixture, gNewsFixture } from '../msw/handlers.js';

describe('News provider mappers (Section 12.5 / 12.6)', () => {
  it('derives sentiment from votes', () => {
    expect(deriveSentimentFromVotes({ positive: 3, negative: 1 })).toBe('positive');
    expect(deriveSentimentFromVotes({ positive: 1, negative: 4 })).toBe('negative');
    expect(deriveSentimentFromVotes({ positive: 2, negative: 2 })).toBe('neutral');
    expect(deriveSentimentFromVotes(null)).toBeNull();
    expect(deriveSentimentFromVotes({ positive: 0, negative: 0 })).toBeNull();
  });

  it('maps CryptoPanic posts', () => {
    const first = cryptoPanicFixture.results[0];
    const item = mapCryptoPanicPost(first);
    expect(item).toMatchObject({
      title: 'Bitcoin hits new high',
      source: 'CoinDesk',
      sentiment: 'positive',
      imageUrl: null,
    });
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
