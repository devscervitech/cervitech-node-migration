// src/middlewares/legacyLogger.ts
import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";

export function legacyLogger(req: Request, res: Response, next: NextFunction) {
  logger.info("Legacy endpoint hit", {
    path: req.originalUrl,
    method: req.method,
    ip: req.ip,
    ua: req.headers["user-agent"] ?? "unknown",
  });
  next();
}