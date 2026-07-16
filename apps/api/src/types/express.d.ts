import type { Logger } from '../lib/logger.js';

declare global {
  namespace Express {
    interface Request {
      log: Logger;
    }

    interface Locals {
      requestId: string;
      startTime: number;
      cacheStatus?: 'hit-l1' | 'hit-l2' | 'miss' | 'n/a';
      degraded?: boolean;
      country?: string | null;
      provider?: string | null;
    }
  }
}

export {};
