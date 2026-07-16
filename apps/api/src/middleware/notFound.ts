import type { NextFunction, Request, Response } from 'express';

import { AppError } from '../lib/errors.js';

export function notFound(_req: Request, _res: Response, next: NextFunction): void {
  next(AppError.notFound('Route not found'));
}
