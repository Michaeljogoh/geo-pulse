import type { IpIntelligence } from '../../types/domain.js';
import type { IpIntelligenceProvider } from '../types.js';

/**
 * Phase 7 — IP-Meta stub (disabled for v1).
 * Mapping target (docs only): GET https://api.ip-meta.xyz/v1/ip-lookup?ip={ip}
 */
export class IpMetaProvider implements IpIntelligenceProvider {
  readonly name = 'ipmeta';

  async lookup(_ip: string): Promise<IpIntelligence> {
    throw new Error('IP-Meta provider disabled for this assignment');
  }
}
