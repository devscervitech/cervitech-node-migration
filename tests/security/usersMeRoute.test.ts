// GET /users/me -- the authenticated caller's own record.
//
// The ordering assertions below are the point of this file. `/:id` is
// registered in users.routes.ts and matches any single path segment, so if
// `/me` is ever moved below it, Express will route GET /users/me into the
// back-office profile handler with id="me". The route keeps answering, with a
// 403 or someone else's data shape, so a status-only test would not catch it.
// These tests assert *which handler ran*.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import { CustomException } from '../../src/utils/customException';

vi.mock('../../src/utils/token.util', () => {
  class InvalidTokenError extends Error {}
  return {
    InvalidTokenError,
    isUserTokenRole: (role: string) => ['APP_USER', 'BACKOFFICE_USER'].includes(role),
    TokenUtil: {
      verifyUserTokenWithAccount: vi.fn(async (token: string) => {
        if (token === 'garbage') throw new InvalidTokenError('nope');
        const role = token === 'office' ? 'BACKOFFICE_USER' : 'APP_USER';
        return {
          payload: { userId: 'owner', role },
          account: { userId: 'owner', role, accessLevel: 'ADMIN', readOnly: false },
        };
      }),
      verifyToken: vi.fn(),
    },
  };
});
vi.mock('../../src/models/TokenBlacklist', () => ({ default: { findOne: vi.fn(async () => null) } }));

const OWN_PROFILE = {
  id: 'owner',
  username: 'owner',
  email: 'owner@example.com',
  hasPaid: true,
  notificationCount: 3,
  currentTargetedAverageNeckAngle: 12,
};

vi.mock('../../src/services/appUserServices/getUserData', () => ({
  GetUserDataService: {
    getOwnProfile: vi.fn(async () => OWN_PROFILE),
    getById: vi.fn(async () => ({ id: 'someone-else', username: 'someone-else' })),
    getByEmail: vi.fn(async () => ({ id: 'someone-else' })),
    getAllowPushNotificationStatus: vi.fn(async () => true),
  },
}));

import userRoutes from '../../src/routes/users.routes';
import { GetUserDataService } from '../../src/services/appUserServices/getUserData';
import { swaggerSpec } from '../../src/config/swagger';

async function request(path: string, auth?: string) {
  const app = express();
  app.use(express.json());
  app.use('/users', userRoutes);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  try {
    const res = await fetch(`http://127.0.0.1:${(server.address() as any).port}${path}`, {
      headers: auth ? { Authorization: `Bearer ${auth}` } : {},
    });
    return { status: res.status, body: await res.json() as any };
  } finally {
    await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
  }
}

beforeEach(() => vi.clearAllMocks());

describe('GET /users/me', () => {
  it('returns the caller’s own record, including hasPaid', async () => {
    const { status, body } = await request('/users/me', 'app');
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toEqual(OWN_PROFILE);
    expect(body.data.hasPaid).toBe(true);
  });

  it('reads the account from the token, not the path', async () => {
    await request('/users/me', 'app');
    expect(GetUserDataService.getOwnProfile).toHaveBeenCalledWith('owner');
  });

  it('is not shadowed by the back-office /:id route', async () => {
    // The regression guard. If /:id wins, getById runs with id="me".
    await request('/users/me', 'app');
    expect(GetUserDataService.getOwnProfile).toHaveBeenCalledTimes(1);
    expect(GetUserDataService.getById).not.toHaveBeenCalled();
  });

  it('does not echo a token back to the caller', async () => {
    const { body } = await request('/users/me', 'app');
    expect(body.data).not.toHaveProperty('token');
  });

  it('returns 401 without a token', async () => {
    expect((await request('/users/me')).status).toBe(401);
  });

  it('returns 401 for an unverifiable token', async () => {
    expect((await request('/users/me', 'garbage')).status).toBe(401);
  });

  it('returns 403 for a back-office token', async () => {
    const { status } = await request('/users/me', 'office');
    expect(status).toBe(403);
    expect(GetUserDataService.getOwnProfile).not.toHaveBeenCalled();
  });

  it('returns 404 when the account no longer exists', async () => {
    vi.mocked(GetUserDataService.getOwnProfile).mockRejectedValueOnce(
      new CustomException('Your account could not be found.')
    );
    const { status, body } = await request('/users/me', 'app');
    expect(status).toBe(404);
    expect(body).toEqual({ success: false, message: 'Your account could not be found.' });
  });

  it('does not leak internal errors', async () => {
    vi.mocked(GetUserDataService.getOwnProfile).mockRejectedValueOnce(new Error('connection reset'));
    const { status, body } = await request('/users/me', 'app');
    expect(status).toBe(500);
    expect(body.message).toBe('Internal server error.');
    expect(JSON.stringify(body)).not.toContain('connection reset');
  });
});

describe('the back-office /:id route still works', () => {
  it('routes a real id to the back-office handler', async () => {
    const { status } = await request('/users/6512abcdef0123456789abcd', 'office');
    expect(status).toBe(200);
    expect(GetUserDataService.getById).toHaveBeenCalledWith('6512abcdef0123456789abcd');
    expect(GetUserDataService.getOwnProfile).not.toHaveBeenCalled();
  });

  it('still refuses an app-user token', async () => {
    expect((await request('/users/6512abcdef0123456789abcd', 'app')).status).toBe(403);
  });
});

describe('OpenAPI', () => {
  it('documents the route with bearer auth', () => {
    const paths = (swaggerSpec as any).paths;
    expect(paths['/users/me'].get.security).toEqual([{ bearerAuth: [] }]);
  });

  it('documents 401 and 403 separately', () => {
    const responses = (swaggerSpec as any).paths['/users/me'].get.responses;
    expect(Object.keys(responses)).toEqual(expect.arrayContaining(['200', '401', '403', '404']));
  });

  it('describes the response as AppUserProfile', () => {
    const schema = (swaggerSpec as any).components.schemas.AppUserProfile;
    expect(schema.properties).toHaveProperty('hasPaid');
    expect(schema.properties).toHaveProperty('currentTargetedAverageNeckAngle');
  });
});
