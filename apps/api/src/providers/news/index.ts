import type { NewsItem } from '../../types/domain.js';
import type { NewsProvider } from '../types.js';
import { CryptoPanicProvider } from './cryptoPanicProvider.js';

/**
 * Phase 9 — news provider factory + CryptoPanic → GNews fallback.
 */
export function getNewsProvider(): NewsProvider {
  return new CryptoPanicProvider();
}

export async function getNews(_params: {
  country?: string;
  symbols?: string[];
  lang?: string;
}): Promise<{ items: NewsItem[]; provider: string }> {
  throw new Error('Not implemented: getNews (Phase 9)');
}
