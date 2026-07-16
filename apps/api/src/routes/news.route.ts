import { Router } from 'express';

/** Phase 9 — GET /api/news */
export const newsRouter = Router();

newsRouter.get('/api/news', (_req, res) => {
  res.status(501).json({
    data: null,
    meta: {
      requestId: res.locals.requestId,
      source: 'live',
      latencyMs: Math.max(0, Date.now() - res.locals.startTime),
      cached: false,
    },
    error: { code: 'INTERNAL', message: 'Not implemented: /api/news (Phase 9)' },
  });
});
