// src/middlewares/deprecatedRoute.ts
import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";

export function deprecatedRoute(canonicalPath: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    logger.warn("Deprecated endpoint hit", {
      path: req.originalUrl,
      method: req.method,
      canonicalPath,
    });
    next();
  };
}
