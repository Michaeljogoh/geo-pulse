import type { Router } from 'express';
import { Router as createRouter } from 'express';

import { env } from '../config/env.js';
import { healthRouter, testValidateRouter } from './health.route.js';

export function createApiRouter(): Router {
  const router = createRouter();
  router.use(healthRouter);
  if (env.NODE_ENV === 'test') {
    router.use(testValidateRouter);
  }
  return router;
}
