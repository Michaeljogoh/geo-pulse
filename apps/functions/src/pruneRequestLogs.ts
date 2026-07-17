import { Timestamp } from 'firebase-admin/firestore';

import { getAdminDb } from './lib/admin';
import { loadConfig } from './lib/config';

export interface PruneResult {
  deleted: number;
  batches: number;
  cutoffIso: string;
}

/**
 * Delete `request_logs` older than retention, in batches ≤ 500.
 * Pure logic exported for unit tests (injectable db).
 */
export async function runPruneRequestLogs(options?: {
  retentionDays?: number;
  batchSize?: number;
  now?: Date;
}): Promise<PruneResult> {
  const cfg = loadConfig();
  const retentionDays = options?.retentionDays ?? cfg.logRetentionDays;
  const batchSize = Math.min(500, options?.batchSize ?? cfg.pruneBatchSize);
  const now = options?.now ?? new Date();
  const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
  const cutoffTs = Timestamp.fromDate(cutoff);

  const db = getAdminDb();
  let deleted = 0;
  let batches = 0;

  // Drain until a page returns fewer than batchSize docs.
  for (;;) {
    const snap = await db
      .collection('request_logs')
      .where('createdAt', '<', cutoffTs)
      .orderBy('createdAt', 'asc')
      .limit(batchSize)
      .get();

    if (snap.empty) break;

    const batch = db.batch();
    for (const doc of snap.docs) {
      batch.delete(doc.ref);
    }
    await batch.commit();
    deleted += snap.size;
    batches += 1;

    console.info(
      JSON.stringify({
        msg: 'pruneRequestLogs batch',
        deleted: snap.size,
        totalDeleted: deleted,
      }),
    );

    if (snap.size < batchSize) break;
  }

  return { deleted, batches, cutoffIso: cutoff.toISOString() };
}
