import { cacheManager } from '../cache/cacheManager.js';
import type { ProviderHealth } from '../types/domain.js';

const startedAt = Date.now();

/** In-memory breaker snapshots (enriched from Firestore in Phase 13). */
const providerSnapshots = new Map<string, ProviderHealth>();

export function registerProviderHealth(snapshot: ProviderHealth): void {
  providerSnapshots.set(snapshot.provider, snapshot);
}

export async function getStatus(): Promise<{
  providers: ProviderHealth[];
  cache: { l1Keys: number; hitRatio: number };
  uptimeSeconds: number;
}> {
  const stats = cacheManager.getL1Stats();
  return {
    providers: Array.from(providerSnapshots.values()),
    cache: {
      l1Keys: stats.l1Keys,
      hitRatio: stats.hitRatio,
    },
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
  };
}
