import { Router } from 'express';

/** Phase 11 — GET /api/status */
export const statusRouter = Router();

statusRouter.get('/api/status', (_req, res) => {
  res.status(501).json({
    data: null,
    meta: {
      requestId: res.locals.requestId,
      source: 'live',
      latencyMs: Math.max(0, Date.now() - res.locals.startTime),
      cached: false,
    },
    error: { code: 'INTERNAL', message: 'Not implemented: /api/status (Phase 11)' },
  });
});
