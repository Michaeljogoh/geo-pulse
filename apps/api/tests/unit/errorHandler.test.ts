import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';

import { AppError } from '../../src/lib/errors.js';
import { errorHandler } from '../../src/middleware/errorHandler.js';

function mockRes() {
  const res = {
    locals: { requestId: 'req-1', startTime: Date.now() },
    statusCode: 200,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json: vi.fn().mockReturnThis(),
  };
  return res as unknown as Response & { statusCode: number; json: ReturnType<typeof vi.fn> };
}

describe('errorHandler', () => {
  it('maps AppError to envelope status', () => {
    const res = mockRes();
    const req = { log: { warn: vi.fn(), error: vi.fn() } } as unknown as Request;
    errorHandler(AppError.validation({ x: 1 }, 'bad'), req, res, vi.fn() as NextFunction);
    expect(res.statusCode).toBe(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: null,
        error: expect.objectContaining({ code: 'VALIDATION_ERROR' }),
      }),
    );
  });

  it('maps unknown errors to INTERNAL', () => {
    const res = mockRes();
    const req = { log: { warn: vi.fn(), error: vi.fn() } } as unknown as Request;
    errorHandler(new Error('boom'), req, res, vi.fn() as NextFunction);
    expect(res.statusCode).toBe(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'INTERNAL' }),
      }),
    );
  });
});
