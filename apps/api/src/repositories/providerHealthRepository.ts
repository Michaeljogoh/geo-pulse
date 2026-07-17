import { Timestamp } from 'firebase-admin/firestore';

import { COLLECTIONS } from '../lib/collections.js';
import { getDb, initFirestore } from '../lib/firestore.js';
import { logger } from '../lib/logger.js';
import type { ProviderHealthDocument, ProviderHealthInput } from '../types/firestore.js';

/** At most one write per provider per 10s (avoids write amplification). */
const UPSERT_THROTTLE_MS = 10_000;
const lastWriteAt = new Map<string, number>();

/**
 * Throttled upsert to `provider_health/{provider}`.
 * Fail-open.
 */
export async function upsertProviderHealth(snapshot: ProviderHealthInput): Promise<void> {
  const now = Date.now();
  const last = lastWriteAt.get(snapshot.provider) ?? 0;
  if (now - last < UPSERT_THROTTLE_MS) {
    return;
  }
  lastWriteAt.set(snapshot.provider, now);

  try {
    initFirestore();
    const doc: ProviderHealthDocument = {
      provider: snapshot.provider,
      state: snapshot.state,
      lastSuccessAt: snapshot.lastSuccessAt
        ? Timestamp.fromDate(snapshot.lastSuccessAt)
        : null,
      lastFailureAt: snapshot.lastFailureAt
        ? Timestamp.fromDate(snapshot.lastFailureAt)
        : null,
      consecutiveFail: snapshot.consecutiveFail,
      successCount: snapshot.successCount,
      failureCount: snapshot.failureCount,
      avgLatencyMs: snapshot.avgLatencyMs,
      updatedAt: Timestamp.now(),
    };
    await getDb().collection(COLLECTIONS.PROVIDER_HEALTH).doc(snapshot.provider).set(doc);
  } catch (err) {
    logger.warn(
      { err, provider: snapshot.provider },
      'provider health write failed (fail-open)',
    );
  }
}

/**
 * Read persisted health docs for status enrichment. Fail-open → [].
 */
export async function listPersistedProviderHealth(): Promise<ProviderHealthDocument[]> {
  try {
    initFirestore();
    const snap = await getDb().collection(COLLECTIONS.PROVIDER_HEALTH).get();
    return snap.docs.map((d) => d.data() as ProviderHealthDocument);
  } catch (err) {
    logger.warn({ err }, 'provider health list failed (fail-open)');
    return [];
  }
}

/** Test helper */
export function _resetProviderHealthThrottleForTests(): void {
  lastWriteAt.clear();
}
