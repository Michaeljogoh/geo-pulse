import type { NextFunction, Request, Response } from 'express';
import type { ZodTypeAny } from 'zod';

import { AppError } from '../lib/errors.js';

export function validateQuery(schema: ZodTypeAny) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) {
      const details = parsed.error.issues.map((issue) => ({
        path: issue.path.join('.') || '(root)',
        issue: issue.message,
      }));
      next(AppError.validation(details, 'Invalid query parameter'));
      return;
    }
    req.query = parsed.data as Request['query'];
    next();
  };
}

export function validateParams(schema: ZodTypeAny) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse(req.params);
    if (!parsed.success) {
      const details = parsed.error.issues.map((issue) => ({
        path: issue.path.join('.') || '(root)',
        issue: issue.message,
      }));
      next(AppError.validation(details, 'Invalid path parameter'));
      return;
    }
    req.params = parsed.data as Request['params'];
    next();
  };
}
