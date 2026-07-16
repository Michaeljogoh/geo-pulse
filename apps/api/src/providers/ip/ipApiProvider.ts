import type { IpIntelligence } from '../../types/domain.js';
import type { IpIntelligenceProvider } from '../types.js';

/** Phase 7 — ip-api.com provider. */
export class IpApiProvider implements IpIntelligenceProvider {
  readonly name = 'ipapi';

  async lookup(_ip: string): Promise<IpIntelligence> {
    throw new Error('Not implemented: IpApiProvider (Phase 7)');
  }
}
