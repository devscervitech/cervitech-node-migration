import { describe, it, expect, vi, beforeEach } from 'vitest';

const countDocuments = vi.fn();
const findFn = vi.fn();

vi.mock('../../src/models/PushNotificationLog', () => ({
  PushNotificationLog: {
    countDocuments: (...args: unknown[]) => countDocuments(...args),
    find: (...args: unknown[]) => findFn(...args),
  },
}));

import { HealthController } from '../../src/controllers/health.controller';

const makeRes = () => {
  const res: any = { statusCode: 0, body: null };
  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn((body: unknown) => {
    res.body = body;
    return res;
  });
  return res;
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('HealthController.getPushHealth', () => {
  it('returns push delivery summary with recent failures and no device tokens', async () => {
    countDocuments
      .mockResolvedValueOnce(120)
      .mockResolvedValueOnce(99)
      .mockResolvedValueOnce(15)
      .mockResolvedValueOnce(6);
    const selectSpy = vi.fn(() => ({
      lean: () =>
        Promise.resolve([
          {
            title: 'Goal reminder',
            dataType: 'goal_reminder',
            error: 'DeviceNotRegistered',
            sentAt: new Date('2026-08-14T08:00:00Z'),
          },
        ]),
    }));
    const limitSpy = vi.fn(() => ({ select: selectSpy }));
    const sortSpy = vi.fn(() => ({ limit: limitSpy }));
    findFn.mockReturnValue({ sort: sortSpy });

    const res = makeRes();
    await HealthController.getPushHealth({} as any, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      success: true,
      message: 'Push health retrieved',
      data: {
        total: 120,
        delivered: 99,
        pending: 15,
        failed: 6,
        recentFailures: [
          {
            title: 'Goal reminder',
            dataType: 'goal_reminder',
            error: 'DeviceNotRegistered',
            sentAt: new Date('2026-08-14T08:00:00Z'),
          },
        ],
      },
    });
    expect(findFn).toHaveBeenCalledWith({ status: 'failed' });
    expect(selectSpy).toHaveBeenCalledWith('-token');
  });

  it('returns a 500 when the aggregation fails', async () => {
    countDocuments.mockRejectedValue(new Error('db down'));

    const res = makeRes();
    await HealthController.getPushHealth({} as any, res);

    expect(res.statusCode).toBe(500);
    expect(res.body.success).toBe(false);
  });
});
