import type { CacheResult } from '../cache/types.js';
import type { IpIntelligence } from '../types/domain.js';

/** Phase 7 — geo lookup service (cache + IP provider chain). */
export async function getGeo(_ip: string): Promise<CacheResult<IpIntelligence>> {
  throw new Error('Not implemented: geoService.getGeo (Phase 7)');
}
