import type { IpIntelligence } from '../../types/domain.js';
import type { IpIntelligenceProvider } from '../types.js';
import { IpApiProvider } from './ipApiProvider.js';

/**
 * Phase 7 — IP provider factory + primary→fallback chain.
 */
export function getIpProvider(): IpIntelligenceProvider {
  return new IpApiProvider();
}

export async function resolveIp(_ip: string): Promise<{
  data: IpIntelligence;
  provider: string;
}> {
  throw new Error('Not implemented: resolveIp (Phase 7)');
}
