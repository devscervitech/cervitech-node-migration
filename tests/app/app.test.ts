import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Express } from 'express';
import type { Server } from 'node:http';

// Keep /api/v1/health/push off the database.
vi.mock('../../src/models/PushNotificationLog', () => ({
  PushNotificationLog: {
    countDocuments: vi.fn(async () => 0),
    find: vi.fn(() => ({ sort: () => ({ limit: () => ({ select: () => ({ lean: async () => [] }) }) }) })),
  },
}));

// The API must build without email configuration (ACS used to throw at import).
delete process.env.ACS_CONNECTION_STRING;
delete process.env.SENDER_EMAIL;

import { createApp } from '../../src/app';

const ALLOWED = 'https://backoffice.example.com';

async function withServer<T>(app: Express, fn: (base: string) => Promise<T>): Promise<T> {
  const server: Server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  try {
    return await fn(`http://127.0.0.1:${(server.address() as any).port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

function appWith(overrides: NodeJS.ProcessEnv) {
  return createApp({ ...process.env, FRONTEND_URL: ALLOWED, NODE_ENV: 'production', ...overrides });
}

afterEach(() => vi.restoreAllMocks());

describe('health endpoints', () => {
  it('serves GET /health as a dependency-free liveness probe', async () => {
    await withServer(appWith({}), async (base) => {
      const res = await fetch(`${base}/health`);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ success: true, message: 'Service is live', data: { status: 'ok' } });
    });
  });

  it('keeps the existing push health route', async () => {
    await withServer(appWith({}), async (base) => {
      const res = await fetch(`${base}/api/v1/health/push`);
      expect(res.status).toBe(200);
      expect((await res.json()).data).toMatchObject({ total: 0, failed: 0 });
    });
  });

  it('documents the liveness probe as an unauthenticated root-level path', async () => {
    await withServer(appWith({}), async (base) => {
      const spec = await (await fetch(`${base}/api-docs.json`)).json();
      expect(spec.paths['/health'].servers).toEqual([{ url: '/' }]);
      expect(spec.paths['/health'].get.security).toEqual([]);
    });
  });
});

describe('fallback handlers', () => {
  it('returns a JSON 404 for unknown routes, including under /api/v1', async () => {
    await withServer(appWith({}), async (base) => {
      for (const path of ['/nope', '/api/v1/nope', '/api/v1/health']) {
        const res = await fetch(`${base}${path}`);
        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({ success: false, message: 'Route not found' });
      }
    });
  });

  it('answers malformed JSON on a real route with a JSON 400', async () => {
    await withServer(appWith({}), async (base) => {
      const res = await fetch(`${base}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"email":',
      });
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ success: false, message: 'Malformed JSON request body' });
    });
  });

  it('registers exactly one JSON body parser', () => {
    const app = appWith({}) as any;
    const parsers = app.router.stack.filter((layer: any) => layer.name === 'jsonParser');
    expect(parsers).toHaveLength(1);
  });
});

describe('existing protected routes', () => {
  const PROTECTED: Array<[string, string]> = [
    ['GET', '/api/v1/transaction'],
    ['POST', '/api/v1/transaction'],
    ['GET', '/api/v1/transaction/abc'],
    ['POST', '/api/v1/goals/turn-on'],
    ['GET', '/api/v1/goals/user-goals'],
    ['PUT', '/api/v1/fcm/token'],
    ['GET', '/api/v1/users/other'],
    ['POST', '/api/v1/neck-angle/records/batch'],
    ['POST', '/api/v1/backoffice-users/signup'],
    ['GET', '/api/v1/backoffice-users'],
    ['DELETE', '/api/v1/backoffice-users/abc'],
    ['PUT', '/api/v1/backoffice-users/abc/access'],
    ['POST', '/api/v1/backoffice-users/logout'],
  ];

  it('still reject unauthenticated requests through the full app stack', async () => {
    await withServer(appWith({}), async (base) => {
      for (const [method, path] of PROTECTED) {
        const res = await fetch(`${base}${path}`, {
          method,
          headers: { 'Content-Type': 'application/json', Origin: ALLOWED },
          body: method === 'GET' ? undefined : '{}',
        });
        expect(res.status, `${method} ${path}`).toBe(401);
        expect(await res.json()).toEqual({ success: false, message: 'Missing or invalid Authorization header' });
      }
    });
  });
});

describe('CORS', () => {
  const docs = (base: string, origin?: string) =>
    fetch(`${base}/api-docs.json`, { headers: origin ? { Origin: origin } : {} });

  it('allows the FRONTEND_URL origin with credentials', async () => {
    await withServer(appWith({ FRONTEND_URL: `${ALLOWED}/admin` }), async (base) => {
      const res = await docs(base, ALLOWED);
      expect(res.headers.get('access-control-allow-origin')).toBe(ALLOWED);
      expect(res.headers.get('access-control-allow-credentials')).toBe('true');
      expect(res.headers.get('vary')).toMatch(/Origin/);

      const preflight = await fetch(`${base}/api/v1/auth/login`, {
        method: 'OPTIONS',
        headers: { Origin: ALLOWED, 'Access-Control-Request-Method': 'POST' },
      });
      expect(preflight.status).toBe(204);
      expect(preflight.headers.get('access-control-allow-origin')).toBe(ALLOWED);
      expect(preflight.headers.get('access-control-allow-methods')).toBe('GET,POST,PUT,DELETE,OPTIONS');
    });
  });

  it('does not grant other origins, including the old hardcoded localhost', async () => {
    await withServer(appWith({}), async (base) => {
      for (const origin of ['https://evil.example.com', 'http://localhost:5173', `${ALLOWED}.evil.com`]) {
        const res = await docs(base, origin);
        expect(res.status).toBe(200);
        expect(res.headers.get('access-control-allow-origin')).toBeNull();
      }
    });
  });

  it('serves requests without an Origin header (mobile and server clients)', async () => {
    await withServer(appWith({}), async (base) => {
      const res = await docs(base);
      expect(res.status).toBe(200);
      expect(res.headers.get('access-control-allow-origin')).toBeNull();
    });
  });

  it('allows the local dev server only when FRONTEND_URL is unset outside production', async () => {
    await withServer(appWith({ FRONTEND_URL: '', NODE_ENV: 'development' }), async (base) => {
      const res = await docs(base, 'http://localhost:5173');
      expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
    });
    await withServer(appWith({ FRONTEND_URL: '', NODE_ENV: 'production' }), async (base) => {
      const res = await docs(base, 'http://localhost:5173');
      expect(res.headers.get('access-control-allow-origin')).toBeNull();
    });
  });

  it('refuses to build with an invalid FRONTEND_URL', () => {
    expect(() => appWith({ FRONTEND_URL: '*' })).toThrow('FRONTEND_URL must be an absolute http(s) URL');
  });
});
