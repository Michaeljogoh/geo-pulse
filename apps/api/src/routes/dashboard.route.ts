import { Router } from 'express';

/** Phase 10 — GET /api/dashboard */
export const dashboardRouter = Router();

dashboardRouter.get('/api/dashboard', (_req, res) => {
  res.status(501).json({
    data: null,
    meta: {
      requestId: res.locals.requestId,
      source: 'live',
      latencyMs: Math.max(0, Date.now() - res.locals.startTime),
      cached: false,
      degraded: true,
    },
    error: { code: 'INTERNAL', message: 'Not implemented: /api/dashboard (Phase 10)' },
  });
});
