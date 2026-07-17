import { cacheManager } from '../cache/cacheManager.js';
import { listProviderHealthFromBreakers } from '../lib/breakerRegistry.js';
import { listPersistedProviderHealth } from '../repositories/providerHealthRepository.js';
import type { ProviderHealth } from '../types/domain.js';

const startedAt = Date.now();

export interface StatusPayload {
  providers: ProviderHealth[];
  cache: { l1Keys: number; hitRatio: number };
  uptimeSeconds: number;
}

function timestampToIso(value: { toDate(): Date } | null | undefined): string | null {
  if (!value || typeof value.toDate !== 'function') return null;
  return value.toDate().toISOString();
}

/**
 * Phase 11 + 13 — breaker snapshots, optionally enriched with Firestore
 * `provider_health` timestamps / avgLatencyMs when available (fail-open).
 */
export async function getStatus(): Promise<StatusPayload> {
  const stats = cacheManager.getL1Stats();
  const inMemory = listProviderHealthFromBreakers();
  const persisted = await listPersistedProviderHealth();
  const byProvider = new Map(persisted.map((p) => [p.provider, p]));

  const providers = inMemory.map((row) => {
    const doc = byProvider.get(row.provider);
    if (!doc) return row;
    return {
      ...row,
      lastSuccessAt: timestampToIso(doc.lastSuccessAt) ?? row.lastSuccessAt,
      lastFailureAt: timestampToIso(doc.lastFailureAt) ?? row.lastFailureAt,
      avgLatencyMs: doc.avgLatencyMs || row.avgLatencyMs,
    };
  });

  return {
    providers,
    cache: {
      l1Keys: stats.l1Keys,
      hitRatio: stats.hitRatio,
    },
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
  };
}
