import { cacheManager } from '../cache/cacheManager.js';
import { listProviderHealthFromBreakers } from '../lib/breakerRegistry.js';
import type { ProviderHealth } from '../types/domain.js';

const startedAt = Date.now();

export async function getStatus(): Promise<{
  providers: ProviderHealth[];
  cache: { l1Keys: number; hitRatio: number };
  uptimeSeconds: number;
}> {
  const stats = cacheManager.getL1Stats();
  return {
    providers: listProviderHealthFromBreakers(),
    cache: {
      l1Keys: stats.l1Keys,
      hitRatio: stats.hitRatio,
    },
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
  };
}
