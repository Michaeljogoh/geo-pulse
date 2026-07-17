import type { CacheSource } from '../cache/types.js';
import type { CacheStatus } from '../types/firestore.js';

/** Map cache layer source → request_logs.cacheStatus (Section 10). */
export function cacheStatusFromSource(source: CacheSource): CacheStatus {
  switch (source) {
    case 'cache-l1':
      return 'hit-l1';
    case 'cache-l2':
      return 'hit-l2';
    case 'live':
      return 'miss';
    case 'fallback':
      return 'n/a';
    default:
      return 'n/a';
  }
}
