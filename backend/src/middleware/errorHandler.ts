import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  console.error('[Error]', err.message);

  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: '参数错误',
      details: err.errors,
    });
    return;
  }

  res.status(500).json({
    success: false,
    error: err.message || '服务器内部错误',
  });
}
