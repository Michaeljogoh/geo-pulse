import { onSchedule } from 'firebase-functions/v2/scheduler';
import { setGlobalOptions } from 'firebase-functions/v2';

import { runPruneRequestLogs } from './pruneRequestLogs';
import { runWarmCache } from './warmCache';

setGlobalOptions({
  region: 'us-central1',
  maxInstances: 1,
});

/**
 * Warm L2 cache by hitting the live API every 5 minutes.
 * Requires `API_BASE_URL` (see docs/setup/functions.md).
 */
export const warmCache = onSchedule(
  {
    schedule: 'every 5 minutes',
    timeoutSeconds: 120,
  },
  async () => {
    const results = await runWarmCache();
    const failed = results.filter((r) => !r.ok);
    if (failed.length === results.length) {
      throw new Error(`warmCache: all endpoints failed (${failed.length})`);
    }
  },
);

/**
 * Prune old request_logs every 24 hours.
 */
export const pruneRequestLogs = onSchedule(
  {
    schedule: 'every 24 hours',
    timeoutSeconds: 540,
  },
  async () => {
    const result = await runPruneRequestLogs();
    console.info(JSON.stringify({ msg: 'pruneRequestLogs done', ...result }));
  },
);
