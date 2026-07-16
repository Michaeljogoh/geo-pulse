import rateLimit from 'express-rate-limit';

import { RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS } from '../config/constants.js';
import { AppError } from '../lib/errors.js';

export const rateLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(AppError.rateLimited());
  },
});
