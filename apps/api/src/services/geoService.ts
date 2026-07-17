import { cacheManager } from '../cache/cacheManager.js';
import type { CacheResult } from '../cache/types.js';
import { CACHE_TTL_GEO_S } from '../config/constants.js';
import { resolveIp } from '../providers/ip/index.js';
import type { IpIntelligence } from '../types/domain.js';

export interface GeoLookupResult extends CacheResult<IpIntelligence> {
  provider: string;
}

interface CachedGeo {
  data: IpIntelligence;
  provider: string;
}

/**
 * Geo lookup via cache + IP provider chain.
 * Private/loopback substitution is handled at the route layer.
 */
export async function getGeo(ip: string): Promise<GeoLookupResult> {
  const cached = await cacheManager.getOrSet<CachedGeo>(
    `geo:${ip}`,
    CACHE_TTL_GEO_S,
    async () => {
      const resolved = await resolveIp(ip);
      return { data: resolved.data, provider: resolved.provider };
    },
  );

  return {
    value: cached.value.data,
    source: cached.source,
    provider: cached.value.provider,
  };
}
