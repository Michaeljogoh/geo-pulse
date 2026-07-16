import { Router } from 'express';

import { asyncHandler } from '../lib/asyncHandler.js';
import { ok } from '../lib/envelope.js';
import { getStatus } from '../services/statusService.js';

/** Section 9.7 — GET /api/status */
export const statusRouter = Router();

statusRouter.get(
  '/api/status',
  asyncHandler(async (_req, res) => {
    const data = await getStatus();
    res.status(200).json(
      ok(data, {
        requestId: res.locals.requestId,
        startTime: res.locals.startTime,
        source: 'live',
        cached: false,
      }),
    );
  }),
);
