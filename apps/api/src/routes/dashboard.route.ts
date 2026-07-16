import { Router } from 'express';

import { asyncHandler } from '../lib/asyncHandler.js';
import { resolveLookupIp } from '../lib/clientIp.js';
import { ok } from '../lib/envelope.js';
import { ipQuerySchema, type IpQuery } from '../lib/querySchemas.js';
import { validateQuery } from '../middleware/validate.js';
import { getDashboard } from '../services/dashboardService.js';

/** Section 9.6 — GET /api/dashboard */
export const dashboardRouter = Router();

dashboardRouter.get(
  '/api/dashboard',
  validateQuery(ipQuerySchema),
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as IpQuery;
    const { ip } = resolveLookupIp(req, query.ip);
    const payload = await getDashboard(ip);

    res.locals.degraded = payload.degraded;
    res.locals.country = payload.visitor.countryCode;

    res.status(200).json(
      ok(payload, {
        requestId: res.locals.requestId,
        startTime: res.locals.startTime,
        source: 'live',
        cached: false,
        degraded: payload.degraded,
        confidence: payload.visitor.confidence,
      }),
    );
  }),
);
