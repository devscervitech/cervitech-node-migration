import winston from 'winston';
import { redact } from './logRedaction';

// Redact before any transport, including process exception/rejection handlers.
export const safeLogFormat = winston.format(info => {
  const safe = redact(info) as Record<string, unknown>;
  for (const key of Object.keys(info)) delete info[key];
  Object.assign(info, safe);
  // Never retain an already-rendered message supplied by an upstream formatter.
  delete info[Symbol.for('message')];
  delete info[Symbol.for('splat')];
  return info;
});

export class logger {
  private static logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(safeLogFormat(), winston.format.timestamp(), winston.format.json()),
    transports: [new winston.transports.Console()],
    exceptionHandlers: [new winston.transports.Console()],
    rejectionHandlers: [new winston.transports.Console()],
  });

  static info(message: string, meta: Record<string, unknown> = {}): void {
    logger.logger.info(message, redact(meta) as object);
  }
  static warn(message: string, meta: Record<string, unknown> = {}): void {
    logger.logger.warn(message, redact(meta) as object);
  }
  static debug(message: string, meta: Record<string, unknown> = {}): void {
    logger.logger.debug(message, redact(meta) as object);
  }
  static error(message: string | Error, meta?: unknown): void {
    logger.logger.error(message instanceof Error ? message.message : message,
      { error: redact(message instanceof Error ? message : meta) });
  }
  static stream = {
    write(message: string): void {
      const status = Number(message.match(/\s(\d{3})\s/)?.[1]);
      if (status >= 500) logger.error(message.trim());
      else if (status >= 300) logger.warn(message.trim());
      else logger.info(message.trim());
    },
  };
}
