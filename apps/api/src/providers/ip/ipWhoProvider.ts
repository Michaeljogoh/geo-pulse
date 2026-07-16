import type { IpIntelligence } from '../../types/domain.js';
import type { IpIntelligenceProvider } from '../types.js';

/** Phase 7 — ipwho.is fallback provider. */
export class IpWhoProvider implements IpIntelligenceProvider {
  readonly name = 'ipwho';

  async lookup(_ip: string): Promise<IpIntelligence> {
    throw new Error('Not implemented: IpWhoProvider (Phase 7)');
  }
}
