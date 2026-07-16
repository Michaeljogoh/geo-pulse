import type { NextFunction, Request, Response } from 'express';

import { logger } from '../lib/logger.js';
import { createRequestId } from '../lib/requestId.js';

export function requestContext(req: Request, res: Response, next: NextFunction): void {
  const requestId = createRequestId();
  res.locals.requestId = requestId;
  res.locals.startTime = Date.now();
  res.setHeader('X-Request-Id', requestId);
  req.log = logger.child({ requestId });
  next();
}
