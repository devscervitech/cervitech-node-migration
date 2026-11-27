// The 401/403 split in auth.middleware.ts. These assertions exist because
// the two statuses were previously interchangeable: an unverifiable token and
// a role refusal both returned 403, so a client could only tell them apart by
// string-matching the message. The mobile client read every 403 as a dead
// session, which turned one back-office permission error into a sign-out loop.
//
// The messages are asserted verbatim on purpose. Clients match on them today,
// so this change moves statuses only; a reworded message is a separate,
// announced change and should fail here first.
import { describe, it, expect, vi } from 'vitest';
import express from 'express';

vi.mock('../../src/utils/token.util', () => {
  class InvalidTokenError extends Error {}
  return {
    InvalidTokenError,
    isUserTokenRole: (role: string) => ['APP_USER', 'BACKOFFICE_USER'].includes(role),
    TokenUtil: {
      verifyUserTokenWithAccount: vi.fn(async (token: string) => {
        if (token === 'garbage') throw new InvalidTokenError('Invalid or expired token');
        if (token === 'unavailable') throw new Error('database unavailable');
        if (token === 'roleless') {
          // Verifies, but the claimed role and the stored role disagree.
          return {
            payload: { userId: 'owner', role: 'APP_USER' },
            account: { userId: 'owner', role: 'BACKOFFICE_USER', accessLevel: 'ADMIN', readOnly: false },
          };
        }
        const role = token === 'office' ? 'BACKOFFICE_USER' : 'APP_USER';
        return {
          payload: { userId: 'owner', role },
          account: { userId: 'owner', role, accessLevel: 'ADMIN', readOnly: false },
        };
      }),
    },
  };
});
vi.mock('../../src/models/TokenBlacklist', () => ({
  default: { findOne: vi.fn(async (q: { token: string }) => (q.token === 'revoked' ? { token: 'revoked' } : null)) },
}));

import { authenticateJWT, authorizeRole } from '../../src/middlewares/auth.middleware';

/** Mounts one app-user-only route and one back-office-only route. */
async function call(path: string, auth?: string) {
  const app = express();
  app.get('/app-only', authenticateJWT, authorizeRole('APP_USER'), (_q, s) => s.json({ ok: true }));
  app.get('/office-only', authenticateJWT, authorizeRole('BACKOFFICE_USER'), (_q, s) => s.json({ ok: true }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  try {
    const res = await fetch(`http://127.0.0.1:${(server.address() as any).port}${path}`, {
      headers: auth ? { Authorization: `Bearer ${auth}` } : {},
    });
    return { status: res.status, body: await res.json() };
  } finally {
    await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
  }
}

describe('401 means authentication failed', () => {
  it('returns 401 when the Authorization header is missing', async () => {
    const { status, body } = await call('/app-only');
    expect(status).toBe(401);
    expect(body).toEqual({ success: false, message: 'Missing or invalid Authorization header' });
  });

  it('returns 401 for a token that cannot be verified', async () => {
    const { status, body } = await call('/app-only', 'garbage');
    expect(status).toBe(401);
    expect(body).toEqual({ success: false, message: 'Invalid or expired token.' });
  });

  it('returns 401 for a revoked token', async () => {
    const { status, body } = await call('/app-only', 'revoked');
    expect(status).toBe(401);
    expect(body).toEqual({ success: false, message: 'Token expired or revoked. Please log in again.' });
  });

  it('returns 401 when the token role cannot be trusted', async () => {
    // Claimed role and stored role disagree, so there is no usable identity.
    const { status, body } = await call('/app-only', 'roleless');
    expect(status).toBe(401);
    expect(body).toEqual({ success: false, message: 'Token missing role information.' });
  });
});

describe('403 means authenticated but not permitted', () => {
  it('returns 403 for an app user on a back-office route', async () => {
    const { status, body } = await call('/office-only', 'app');
    expect(status).toBe(403);
    expect(body).toEqual({ success: false, message: 'Access denied. Only BACKOFFICE_USERs are allowed.' });
  });

  it('returns 403 for a back-office user on an app-user route', async () => {
    const { status, body } = await call('/app-only', 'office');
    expect(status).toBe(403);
    expect(body).toEqual({ success: false, message: 'Access denied. Only APP_USERs are allowed.' });
  });

  it('lets a correctly-roled caller through', async () => {
    expect((await call('/app-only', 'app')).status).toBe(200);
    expect((await call('/office-only', 'office')).status).toBe(200);
  });
});

describe('503 means retry, not sign out', () => {
  it('does not report an infrastructure failure as an auth failure', async () => {
    const { status, body } = await call('/app-only', 'unavailable');
    expect(status).toBe(503);
    expect(body).toEqual({ success: false, message: 'Authentication temporarily unavailable' });
  });
});

describe('the two failures are distinguishable without reading the message', () => {
  it('gives a dead token and a permission refusal different statuses', async () => {
    const deadToken = await call('/office-only', 'garbage');
    const refusal = await call('/office-only', 'app');
    expect(deadToken.status).toBe(401);
    expect(refusal.status).toBe(403);
    expect(deadToken.status).not.toBe(refusal.status);
  });
});
