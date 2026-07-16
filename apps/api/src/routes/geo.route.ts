import { Router } from 'express';

/** Phase 7 — GET /api/geo */
export const geoRouter = Router();

geoRouter.get('/api/geo', (_req, res) => {
  res.status(501).json({
    data: null,
    meta: {
      requestId: res.locals.requestId,
      source: 'live',
      latencyMs: Math.max(0, Date.now() - res.locals.startTime),
      cached: false,
    },
    error: { code: 'INTERNAL', message: 'Not implemented: /api/geo (Phase 7)' },
  });
});
