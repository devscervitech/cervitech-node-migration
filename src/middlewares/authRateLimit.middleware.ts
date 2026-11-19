import { createHash } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import AuthRateLimitBucket from '../models/AuthRateLimitBucket';
import { logger } from '../utils/logger';

export function authRateLimit(bucketName: string, limit: number, windowMs: number) {
  return async function authRateLimitMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const now = Date.now();
    const windowStart = Math.floor(now / windowMs) * windowMs;
    const windowEnd = windowStart + windowMs;
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const bucketKey = createHash('sha256')
      .update(`${bucketName}:${clientIp}:${windowStart}`)
      .digest('hex');
    const filter = { bucketKey };
    const upsert = () =>
      AuthRateLimitBucket.findOneAndUpdate(
        filter,
        {
          $inc: { count: 1 },
          $setOnInsert: { expiresAt: new Date(windowEnd + windowMs) },
        },
        { upsert: true, new: true }
      ).lean();

    try {
      let bucket;
      try {
        bucket = await upsert();
      } catch (error: unknown) {
        if ((error as { code?: number })?.code !== 11000) throw error;
        bucket = await AuthRateLimitBucket.findOneAndUpdate(
          filter,
          { $inc: { count: 1 } },
          { new: true }
        ).lean();
      }

      const count = (bucket as { count?: unknown } | null)?.count;
      if (typeof count !== 'number' || !Number.isInteger(count)) {
        throw new Error('Rate-limit bucket was not updated');
      }

      if (count > limit) {
        res.setHeader('Retry-After', String(Math.max(1, Math.ceil((windowEnd - now) / 1000))));
        res.status(429).json({
          success: false,
          message: 'Too many requests. Please try again later.',
        });
        return;
      }

      next();
    } catch (error: unknown) {
      logger.error('Authentication rate-limit storage unavailable.', {
        bucketName,
        errorName: error instanceof Error ? error.name : 'UnknownError',
      });
      res.status(503).json({
        success: false,
        message: 'Authentication service temporarily unavailable.',
      });
    }
  };
}
