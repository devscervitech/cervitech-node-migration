// src/middlewares/errorHandler.middleware.ts
import { STATUS_CODES } from 'node:http';
import { ErrorRequestHandler, RequestHandler } from 'express';
import { sendError } from '../utils/apiResponse';
import { logger } from '../utils/logger';
import { TransactionError } from '../utils/transactionError';

/** Registered after every route: JSON 404 instead of Express's default HTML page. */
export const notFoundHandler: RequestHandler = (_req, res) => {
  sendError(res, 404, 'Route not found');
};

function httpStatusOf(err: any): number | undefined {
  const status = err?.status ?? err?.statusCode;
  return Number.isInteger(status) && status >= 400 && status <= 599 ? status : undefined;
}

/**
 * Last-resort handler for errors that controllers did not handle themselves
 * (Express 5 forwards rejected async handlers here automatically). Controllers
 * keep their own error responses; this only guarantees a safe JSON reply.
 *
 * Client-facing messages are fixed strings: error messages can carry request
 * bodies (JSON parse errors) or internals (driver errors, connection strings),
 * so they are logged (redacted) but never echoed back.
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  const context = { method: req.method, path: req.path };

  if (res.headersSent) {
    logger.error('Error raised after response started', { ...context, error: err });
    next(err);
    return;
  }

  // Preserve the purchase-flow contract ({ error, code }) used by transaction.controller.
  if (err instanceof TransactionError) {
    const meta = { ...context, code: err.code, status: err.statusCode };
    if (err.statusCode >= 500) logger.error('Unhandled transaction error', meta);
    else logger.warn('Unhandled transaction error', meta);
    res.status(err.statusCode).json({ error: err.message, code: err.code });
    return;
  }

  const status = httpStatusOf(err) ?? 500;
  if (status < 500) {
    // e.g. body-parser: malformed JSON (400), payload too large (413).
    logger.warn('Request rejected', { ...context, status, type: err?.type });
    const message =
      err?.type === 'entity.parse.failed'
        ? 'Malformed JSON request body'
        : (STATUS_CODES[status] ?? 'Bad Request');
    sendError(res, status, message);
    return;
  }

  logger.error('Unhandled request error', { ...context, error: err });
  sendError(res, status, 'Internal server error');
};
