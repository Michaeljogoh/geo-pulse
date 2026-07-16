import type { Router } from 'express';
import { Router as createRouter } from 'express';

import { env } from '../config/env.js';
import { dashboardRouter } from './dashboard.route.js';
import { geoRouter } from './geo.route.js';
import { healthRouter, testValidateRouter } from './health.route.js';
import { marketRouter } from './market.route.js';
import { meRouter } from './me.route.js';
import { newsRouter } from './news.route.js';
import { statusRouter } from './status.route.js';
import { watchlistRouter } from './watchlist.route.js';

export function createApiRouter(): Router {
  const router = createRouter();

  router.use(healthRouter);
  router.use(geoRouter);
  router.use(marketRouter);
  router.use(newsRouter);
  router.use(dashboardRouter);
  router.use(statusRouter);
  router.use(meRouter);
  router.use(watchlistRouter);

  if (env.NODE_ENV === 'test') {
    router.use(testValidateRouter);
  }

  return router;
}
