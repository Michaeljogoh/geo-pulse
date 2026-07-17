import type { RequestHandler, Router } from 'express';
import { Router as createRouter } from 'express';
import { z } from 'zod';

import { asyncHandler } from '../lib/asyncHandler.js';
import { checkFirestoreHealth } from '../lib/firestore.js';
import { validateQuery } from '../middleware/validate.js';

const startedAt = Date.now();

export const healthRouter: Router = createRouter();

healthRouter.get(
  '/health',
  asyncHandler(async (_req, res) => {
    const firestore = await checkFirestoreHealth();
    res.status(200).json({
      status: 'ok',
      uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      firestore,
    });
  }),
);

/** Test-only validation route used by contract tests. */
export const testValidateRouter: Router = createRouter();

testValidateRouter.get(
  '/api/_test/validate',
  validateQuery(z.object({ q: z.string().min(1) })),
  ((_req, res) => {
    res.status(200).json({
      data: { ok: true },
      meta: {
        requestId: res.locals.requestId,
        source: 'live',
        latencyMs: Math.max(0, Date.now() - res.locals.startTime),
        cached: false,
      },
      error: null,
    });
  }) as RequestHandler,
);
