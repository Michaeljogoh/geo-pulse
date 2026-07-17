import { Router } from 'express';

import { asyncHandler } from '../lib/asyncHandler.js';
import { cacheStatusFromSource } from '../lib/cacheStatus.js';
import { ok } from '../lib/envelope.js';
import {
  marketQuerySchema,
  trendingQuerySchema,
  type MarketQuery,
  type TrendingQuery,
} from '../lib/querySchemas.js';
import { validateQuery } from '../middleware/validate.js';
import { getMarket, getTrending } from '../services/marketService.js';

/** Section 9.3 / 9.4 — GET /api/market, GET /api/trending */
export const marketRouter = Router();

marketRouter.get(
  '/api/market',
  validateQuery(marketQuerySchema),
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as MarketQuery;
    const result = await getMarket(query.vs, query.limit);

    res.locals.cacheStatus = cacheStatusFromSource(result.source);
    res.locals.provider = 'coingecko';

    res.status(200).json(
      ok(result.value, {
        requestId: res.locals.requestId,
        startTime: res.locals.startTime,
        source: result.source,
        cached: result.source === 'cache-l1' || result.source === 'cache-l2',
        provider: 'coingecko',
      }),
    );
  }),
);

marketRouter.get(
  '/api/trending',
  validateQuery(trendingQuerySchema),
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as TrendingQuery;
    const result = await getTrending(query.vs);

    res.locals.cacheStatus = cacheStatusFromSource(result.source);
    res.locals.provider = 'coingecko';

    res.status(200).json(
      ok(result.value, {
        requestId: res.locals.requestId,
        startTime: res.locals.startTime,
        source: result.source,
        cached: result.source === 'cache-l1' || result.source === 'cache-l2',
        provider: 'coingecko',
      }),
    );
  }),
);
