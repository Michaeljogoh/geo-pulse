import { Router } from 'express';

import { asyncHandler } from '../lib/asyncHandler.js';
import { ok } from '../lib/envelope.js';
import { AppError } from '../lib/errors.js';
import { requireAuth } from '../middleware/auth.js';
import { upsertOnLogin } from '../repositories/userRepository.js';

/** Section 9.9 — GET /api/me (protected). */
export const meRouter = Router();

meRouter.get(
  '/api/me',
  asyncHandler(requireAuth),
  asyncHandler(async (_req, res) => {
    const user = res.locals.user;
    if (!user) {
      throw AppError.unauthenticated();
    }

    // Fire-and-forget profile upsert (fail-open inside repository).
    void upsertOnLogin(user);

    res.status(200).json(
      ok(user, {
        requestId: res.locals.requestId,
        startTime: res.locals.startTime,
        source: 'live',
        cached: false,
      }),
    );
  }),
);
