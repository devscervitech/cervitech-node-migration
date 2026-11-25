import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';

const logger = vi.hoisted(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }));
vi.mock('../../src/utils/logger', () => ({ logger }));

import { errorHandler, notFoundHandler } from '../../src/middlewares/errorHandler.middleware';
import { TransactionError } from '../../src/utils/transactionError';

const SECRET = 'mongodb://admin:hunter2@db.internal:27017';
let server: Server;
let base: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.post('/echo', (req, res) => {
    res.json(req.body);
  });
  app.get('/sync-boom', () => {
    throw new Error(`connection failed for ${SECRET}`);
  });
  app.get('/async-boom', async () => {
    await Promise.resolve();
    throw new Error(`connection failed for ${SECRET}`);
  });
  app.get('/tx-400', async () => {
    throw new TransactionError('PURCHASE_TOKEN_INVALID', 'A verified Google Play purchase token is required.', 400);
  });
  app.get('/tx-500', async () => {
    throw new TransactionError('GOOGLE_PLAY_CONFIGURATION_MISSING', 'Google Play purchase verification is not configured.', 500);
  });
  app.get('/status-413', () => {
    throw Object.assign(new Error(`too big: ${SECRET}`), { status: 413 });
  });
  app.get('/status-503', () => {
    throw Object.assign(new Error(`upstream: ${SECRET}`), { statusCode: 503 });
  });
  app.use(notFoundHandler);
  app.use(errorHandler);

  server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as any).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => vi.clearAllMocks());

async function call(path: string, init?: RequestInit) {
  const res = await fetch(`${base}${path}`, init);
  const text = await res.text();
  return { status: res.status, type: res.headers.get('content-type'), text, body: JSON.parse(text) };
}

describe('notFoundHandler', () => {
  it('returns a JSON 404 in the standard error shape', async () => {
    const res = await call('/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.type).toMatch(/application\/json/);
    expect(res.body).toEqual({ success: false, message: 'Route not found' });
  });
});

describe('errorHandler', () => {
  it.each(['/sync-boom', '/async-boom'])('turns unexpected errors from %s into a safe 500', async (path) => {
    const res = await call(path);
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ success: false, message: 'Internal server error' });
    expect(res.text).not.toContain('hunter2');
    expect(res.text).not.toMatch(/stack|at .*\.ts/);
    expect(logger.error).toHaveBeenCalledWith(
      'Unhandled request error',
      expect.objectContaining({ method: 'GET', path, error: expect.any(Error) })
    );
  });

  it('preserves TransactionError status codes and the { error, code } contract', async () => {
    expect(await call('/tx-400')).toMatchObject({
      status: 400,
      body: { error: 'A verified Google Play purchase token is required.', code: 'PURCHASE_TOKEN_INVALID' },
    });
    expect(await call('/tx-500')).toMatchObject({
      status: 500,
      body: { error: 'Google Play purchase verification is not configured.', code: 'GOOGLE_PLAY_CONFIGURATION_MISSING' },
    });
  });

  it('keeps HTTP error statuses but never echoes their messages', async () => {
    const tooLarge = await call('/status-413');
    expect(tooLarge.status).toBe(413);
    expect(tooLarge.body).toEqual({ success: false, message: 'Payload Too Large' });

    const unavailable = await call('/status-503');
    expect(unavailable.status).toBe(503);
    expect(unavailable.body).toEqual({ success: false, message: 'Internal server error' });
    expect(unavailable.text + tooLarge.text).not.toContain('hunter2');
  });

  it('rejects malformed JSON with a 400 without echoing or logging the body', async () => {
    const res = await call('/echo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"password":"hunter2",',
    });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, message: 'Malformed JSON request body' });
    expect(res.text).not.toContain('hunter2');
    expect(JSON.stringify(logger.warn.mock.calls)).not.toContain('hunter2');
  });

  it('still parses valid JSON bodies', async () => {
    const res = await call('/echo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hello: 'world' }),
    });
    expect(res).toMatchObject({ status: 200, body: { hello: 'world' } });
  });

  it('delegates to Express when the response has already started', () => {
    const next = vi.fn();
    const res = { headersSent: true, status: vi.fn(), json: vi.fn() } as any;
    const err = new Error('late failure');
    errorHandler(err, { method: 'GET', path: '/stream' } as any, res, next);
    expect(next).toHaveBeenCalledWith(err);
    expect(res.status).not.toHaveBeenCalled();
  });
});
