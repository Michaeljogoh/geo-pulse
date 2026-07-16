import { Router } from 'express';

import { asyncHandler } from '../lib/asyncHandler.js';
import { ok } from '../lib/envelope.js';
import { newsQuerySchema, type NewsQuery } from '../lib/querySchemas.js';
import { validateQuery } from '../middleware/validate.js';
import { getNews } from '../services/newsService.js';

/** Section 9.5 — GET /api/news */
export const newsRouter = Router();

newsRouter.get(
  '/api/news',
  validateQuery(newsQuerySchema),
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as NewsQuery;
    const result = await getNews({
      country: query.country,
      symbols: query.symbols,
      lang: query.lang,
    });

    res.status(200).json(
      ok(result.value, {
        requestId: res.locals.requestId,
        startTime: res.locals.startTime,
        source: result.source,
        cached: result.source === 'cache-l1' || result.source === 'cache-l2',
      }),
    );
  }),
);
