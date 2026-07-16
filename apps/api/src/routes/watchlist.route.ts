import { Router } from 'express';

import { asyncHandler } from '../lib/asyncHandler.js';
import { ok } from '../lib/envelope.js';
import { AppError } from '../lib/errors.js';
import {
  coinIdParamSchema,
  watchlistQuerySchema,
  type CoinIdParams,
  type WatchlistQuery,
} from '../lib/querySchemas.js';
import { requireAuth } from '../middleware/auth.js';
import { validateParams, validateQuery } from '../middleware/validate.js';
import {
  addWatchlistItem,
  getWatchlist,
  removeWatchlistItem,
} from '../services/watchlistService.js';

/** Section 9.9 — /api/watchlist (protected). */
export const watchlistRouter = Router();

watchlistRouter.get(
  '/api/watchlist',
  asyncHandler(requireAuth),
  validateQuery(watchlistQuerySchema),
  asyncHandler(async (_req, res) => {
    const user = res.locals.user;
    if (!user) throw AppError.unauthenticated();
    const query = _req.query as unknown as WatchlistQuery;
    const items = await getWatchlist(user.uid, query.vs);
    res.status(200).json(
      ok(items, {
        requestId: res.locals.requestId,
        startTime: res.locals.startTime,
        source: 'live',
        cached: false,
      }),
    );
  }),
);

watchlistRouter.put(
  '/api/watchlist/:coinId',
  asyncHandler(requireAuth),
  validateParams(coinIdParamSchema),
  validateQuery(watchlistQuerySchema),
  asyncHandler(async (req, res) => {
    const user = res.locals.user;
    if (!user) throw AppError.unauthenticated();
    const params = req.params as unknown as CoinIdParams;
    const query = req.query as unknown as WatchlistQuery;
    const items = await addWatchlistItem(user.uid, params.coinId, query.vs);
    res.status(200).json(
      ok(items, {
        requestId: res.locals.requestId,
        startTime: res.locals.startTime,
        source: 'live',
        cached: false,
      }),
    );
  }),
);

watchlistRouter.delete(
  '/api/watchlist/:coinId',
  asyncHandler(requireAuth),
  validateParams(coinIdParamSchema),
  validateQuery(watchlistQuerySchema),
  asyncHandler(async (req, res) => {
    const user = res.locals.user;
    if (!user) throw AppError.unauthenticated();
    const params = req.params as unknown as CoinIdParams;
    const query = req.query as unknown as WatchlistQuery;
    const items = await removeWatchlistItem(user.uid, params.coinId, query.vs);
    res.status(200).json(
      ok(items, {
        requestId: res.locals.requestId,
        startTime: res.locals.startTime,
        source: 'live',
        cached: false,
      }),
    );
  }),
);
