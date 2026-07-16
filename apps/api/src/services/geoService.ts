import type { CacheResult } from '../cache/types.js';
import type { IpIntelligence } from '../types/domain.js';

export interface GeoLookupResult extends CacheResult<IpIntelligence> {
  provider: string;
}

/** Phase 7 — geo lookup service (cache + IP provider chain). */
export async function getGeo(_ip: string): Promise<GeoLookupResult> {
  throw Object.assign(new Error('Not implemented: geoService.getGeo (Phase 7)'), {
    isUpstream: true,
  });
}
