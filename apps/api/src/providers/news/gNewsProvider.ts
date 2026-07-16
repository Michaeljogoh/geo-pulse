import type { NewsItem } from '../../types/domain.js';
import type { NewsProvider } from '../types.js';

/** Phase 9 — GNews regional fallback provider. */
export class GNewsProvider implements NewsProvider {
  readonly name = 'gnews';

  async getNews(_params: {
    country?: string;
    symbols?: string[];
    lang?: string;
  }): Promise<NewsItem[]> {
    throw new Error('Not implemented: GNewsProvider (Phase 9)');
  }
}
