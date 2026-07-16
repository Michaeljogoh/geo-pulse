import { Router } from 'express';

/** Phase 15 — /api/watchlist (protected). */
export const watchlistRouter = Router();

watchlistRouter.get('/api/watchlist', (_req, res) => {
  res.status(501).json({
    data: null,
    meta: {
      requestId: res.locals.requestId,
      source: 'live',
      latencyMs: Math.max(0, Date.now() - res.locals.startTime),
      cached: false,
    },
    error: { code: 'INTERNAL', message: 'Not implemented: /api/watchlist (Phase 15)' },
  });
});
