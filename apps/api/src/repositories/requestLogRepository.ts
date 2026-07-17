import { Timestamp } from 'firebase-admin/firestore';

import { COLLECTIONS } from '../lib/collections.js';
import { getDb, initFirestore } from '../lib/firestore.js';
import { logger } from '../lib/logger.js';
import type { RequestLogInput } from '../types/firestore.js';

/**
 * Fire-and-forget write to `request_logs/{autoId}`.
 * Never throws to callers — fail-open.
 */
export async function createRequestLog(log: RequestLogInput): Promise<void> {
  try {
    initFirestore();
    await getDb()
      .collection(COLLECTIONS.REQUEST_LOGS)
      .add({
        ...log,
        createdAt: Timestamp.now(),
      });
  } catch (err) {
    logger.warn({ err, requestId: log.requestId }, 'request log write failed (fail-open)');
  }
}
