import { env } from '../../config/env.js';
import { AppError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import type { IpIntelligence } from '../../types/domain.js';
import { withResilience } from '../withResilience.js';
import type { IpIntelligenceProvider } from '../types.js';
import { IpApiProvider } from './ipApiProvider.js';
import { IpMetaProvider } from './ipMetaProvider.js';
import { IpWhoProvider } from './ipWhoProvider.js';

const providers = {
  ipapi: () => new IpApiProvider(),
  ipwho: () => new IpWhoProvider(),
  ipmeta: () => new IpMetaProvider(),
} as const;

export function getIpProvider(name: typeof env.IP_PROVIDER = env.IP_PROVIDER): IpIntelligenceProvider {
  if (name === 'ipmeta') {
    throw AppError.validation(undefined, 'IP_PROVIDER=ipmeta is not selectable in v1');
  }
  return providers[name]();
}

function fallbackProvider(primary: typeof env.IP_PROVIDER): IpIntelligenceProvider {
  return primary === 'ipwho' ? new IpApiProvider() : new IpWhoProvider();
}

/**
 * Primary → fallback chain (Phase 7).
 * Annotates which provider succeeded.
 */
export async function resolveIp(ip: string): Promise<{
  data: IpIntelligence;
  provider: string;
  latencyMs: number;
}> {
  const primaryName = env.IP_PROVIDER === 'ipmeta' ? 'ipapi' : env.IP_PROVIDER;
  const primary = getIpProvider(primaryName);
  const secondary = fallbackProvider(primaryName);

  try {
    const wrapped = await withResilience(primary.name, () => primary.lookup(ip));
    return {
      data: wrapped.result,
      provider: wrapped.provider,
      latencyMs: wrapped.latencyMs,
    };
  } catch (primaryErr) {
    logger.warn(
      { err: primaryErr, provider: primary.name, ip },
      'primary IP provider failed; trying fallback',
    );
    try {
      const wrapped = await withResilience(secondary.name, () => secondary.lookup(ip));
      return {
        data: wrapped.result,
        provider: wrapped.provider,
        latencyMs: wrapped.latencyMs,
      };
    } catch (fallbackErr) {
      logger.warn(
        { err: fallbackErr, provider: secondary.name, ip },
        'fallback IP provider failed',
      );
      throw fallbackErr instanceof AppError
        ? fallbackErr
        : AppError.upstreamError('All IP providers failed');
    }
  }
}
