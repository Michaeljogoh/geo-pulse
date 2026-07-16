import { Router } from 'express';

/** Phase 14 — GET /api/me (protected). */
export const meRouter = Router();

meRouter.get('/api/me', (_req, res) => {
  res.status(501).json({
    data: null,
    meta: {
      requestId: res.locals.requestId,
      source: 'live',
      latencyMs: Math.max(0, Date.now() - res.locals.startTime),
      cached: false,
    },
    error: { code: 'INTERNAL', message: 'Not implemented: /api/me (Phase 14)' },
  });
});
