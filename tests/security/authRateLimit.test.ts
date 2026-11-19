import { beforeEach, describe, expect, it, vi } from 'vitest';

const bucketStore = vi.hoisted(() => ({ findOneAndUpdate: vi.fn() }));

vi.mock('../../src/utils/EmailService/emailutils', () => ({
  EmailUtils: {
    sendSignupEmail: vi.fn(),
    sendPasswordResetOtpEmail: vi.fn(),
  },
}));

vi.mock('../../src/models/AuthRateLimitBucket', () => ({
  default: {
    findOneAndUpdate: (...args: unknown[]) => bucketStore.findOneAndUpdate(...args),
  },
}));

import { authRateLimit } from '../../src/middlewares/authRateLimit.middleware';
import authRoutes from '../../src/routes/auth.routes';
import backofficeRoutes from '../../src/routes/backOfficeUser.routes';
import { swaggerSpec } from '../../src/config/swagger';

const makeRequest = (ip = '192.0.2.5') => ({
  ip,
  socket: { remoteAddress: '192.0.2.5' },
});

const makeResponse = () => {
  const response: any = {};
  response.headers = {};
  response.status = vi.fn().mockReturnValue(response);
  response.json = vi.fn().mockReturnValue(response);
  response.setHeader = vi.fn((name: string, value: string) => {
    response.headers[name] = value;
    return response;
  });
  return response;
};

const bucketQuery = (value: unknown) => ({ lean: () => Promise.resolve(value) });

describe('authentication rate limiting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses a hashed client address and allows a request within the configured limit', async () => {
    bucketStore.findOneAndUpdate.mockReturnValue(bucketQuery({ count: 1 }));
    const next = vi.fn();
    const response = makeResponse();

    await authRateLimit('app-login', 10, 60_000)(
      makeRequest() as any,
      response,
      next
    );

    const [filter, update, options] = bucketStore.findOneAndUpdate.mock.calls[0];
    expect(filter.bucketKey).toMatch(/^[a-f0-9]{64}$/);
    expect(filter.bucketKey).not.toContain('192.0.2.5');
    expect(update.$inc.count).toBe(1);
    expect(options).toMatchObject({ upsert: true, new: true });
    expect(next).toHaveBeenCalledOnce();
  });

  it('returns 429 with Retry-After after the bucket limit is exceeded', async () => {
    bucketStore.findOneAndUpdate.mockReturnValue(bucketQuery({ count: 3 }));
    const next = vi.fn();
    const response = makeResponse();

    await authRateLimit('app-login', 2, 60_000)(makeRequest() as any, response, next);

    expect(response.status).toHaveBeenCalledWith(429);
    expect(response.headers['Retry-After']).toMatch(/^\d+$/);
    expect(next).not.toHaveBeenCalled();
  });

  it('recovers from a concurrent first-insert race without opening a second bucket', async () => {
    bucketStore.findOneAndUpdate
      .mockReturnValueOnce({ lean: () => Promise.reject({ code: 11000 }) })
      .mockReturnValueOnce(bucketQuery({ count: 1 }));
    const next = vi.fn();

    await authRateLimit('app-login', 10, 60_000)(
      makeRequest() as any,
      makeResponse(),
      next
    );

    expect(bucketStore.findOneAndUpdate).toHaveBeenCalledTimes(2);
    expect(bucketStore.findOneAndUpdate.mock.calls[1][2]).toMatchObject({ new: true });
    expect(next).toHaveBeenCalledOnce();
  });

  it('fails closed with 503 if the shared rate-limit store is unavailable', async () => {
    bucketStore.findOneAndUpdate.mockReturnValue({
      lean: () => Promise.reject(new Error('database unavailable')),
    });
    const next = vi.fn();
    const response = makeResponse();

    await authRateLimit('app-login', 2, 60_000)(makeRequest() as any, response, next);

    expect(response.status).toHaveBeenCalledWith(503);
    expect(next).not.toHaveBeenCalled();
  });

  it('places a limiter before every public app-user and back-office auth handler', () => {
    const hasLimiter = (router: any, method: string, path: string) =>
      router.stack.some(
        (layer: any) =>
          layer.route?.path === path &&
          layer.route?.methods?.[method] &&
          layer.route.stack.some(
            (handler: any) => handler.name === 'authRateLimitMiddleware'
          )
      );
    const appAuthRoutes: [string, string][] = [
      ['post', '/signup'],
      ['post', '/login'],
      ['post', '/request-reset'],
      ['post', '/verify-reset-otp'],
      ['post', '/reset-password'],
      ['get', '/usernames/exists'],
      ['get', '/validate-email'],
    ];
    const backofficeAuthRoutes: [string, string][] = [
      ['post', '/login'],
      ['post', '/forgot-password'],
      ['post', '/verify-reset-otp'],
      ['post', '/reset-password'],
    ];
    for (const [method, path] of appAuthRoutes) {
      expect(hasLimiter(authRoutes, method, path)).toBe(true);
    }
    for (const [method, path] of backofficeAuthRoutes) {
      expect(hasLimiter(backofficeRoutes, method, path)).toBe(true);
    }
  });

  it('documents 429 responses for app-user login and password-reset requests', () => {
    const paths = (swaggerSpec as any).paths;
    expect(paths['/auth/login'].post.responses['429']).toBeDefined();
    expect(paths['/auth/request-reset'].post.responses['429']).toBeDefined();
    expect(paths['/backoffice-users/login'].post.responses['429']).toBeDefined();
    expect(paths['/backoffice-users/forgot-password'].post.responses['429']).toBeDefined();
  });
});
