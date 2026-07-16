import type { NewsItem } from '../../types/domain.js';
import type { NewsProvider } from '../types.js';

/** Phase 9 — CryptoPanic primary news provider. */
export class CryptoPanicProvider implements NewsProvider {
  readonly name = 'cryptopanic';

  async getNews(_params: {
    country?: string;
    symbols?: string[];
    lang?: string;
  }): Promise<NewsItem[]> {
    throw new Error('Not implemented: CryptoPanicProvider (Phase 9)');
  }
}
