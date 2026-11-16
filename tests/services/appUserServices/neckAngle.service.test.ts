import { describe, it, expect, vi, beforeEach } from 'vitest';

const userFindById = vi.fn();
const userFind = vi.fn();
const userUpdateOne = vi.fn();
const recordFindOne = vi.fn();
const recordFind = vi.fn();
const recordSave = vi.fn();
const compareAverage = vi.fn();
const sendPush = vi.fn();
const responseRateSave = vi.fn();

interface StoredUser {
  _id: string;
  prompt?: number;
  fcmToken?: string;
  allowPushNotifications?: boolean;
  notificationCount?: number;
  save?: (...args: unknown[]) => Promise<unknown>;
}

// Miniature database: records and users keyed per user id so counters never
// leak between users, and both user lookups the service makes (findById and
// find) read the same store — a user without a token is tokenless in both.
const users = new Map<string, StoredUser>();
const recordsByUser = new Map<string, { counter: number }[]>();

vi.mock('../../../src/models/AppUser', () => ({
  default: {
    findById: (...args: unknown[]) => userFindById(...args),
    find: (...args: unknown[]) => userFind(...args),
    updateOne: (...args: unknown[]) => userUpdateOne(...args),
  },
}));

vi.mock('../../../src/models/NeckAngleRecord', () => {
  const ctor = vi.fn(function (this: any, fields: any) {
    Object.assign(this, fields);
    const list = recordsByUser.get(fields.appUserId);
    if (list) list.push({ counter: this.counter });
    else recordsByUser.set(fields.appUserId, [{ counter: this.counter }]);
    this.save = recordSave;
  });
  return {
    NeckAngleRecordModel: Object.assign(ctor, {
      findOne: (...args: unknown[]) => recordFindOne(...args),
      find: (...args: unknown[]) => recordFind(...args),
    }),
  };
});

vi.mock('../../../src/utils/utils', () => ({
  Utils: { compareAverageNeckAngle: (...args: unknown[]) => compareAverage(...args) },
}));

vi.mock('../../../src/services/pushNotificationDriver', () => ({
  PushNotificationDriver: { sendPushNotification: (...args: unknown[]) => sendPush(...args) },
}));

vi.mock('../../../src/models/ResponseRate', () => ({
  default: vi.fn(function (this: any, fields: unknown) {
    Object.assign(this, fields as object);
    this.save = responseRateSave;
  }),
}));

import { NeckAngleService } from '../../../src/services/appUserServices/neckAngle.service';

const TOKEN = 'ExponentPushToken[abc]';
const OTHER_TOKEN = 'ExponentPushToken[def]';

beforeEach(() => {
  vi.clearAllMocks();
  users.clear();
  recordsByUser.clear();

  responseRateSave.mockResolvedValue(undefined);
  recordSave.mockResolvedValue(undefined);

  userFindById.mockImplementation((idOrFilter: string | { _id: string }) => {
    const id = typeof idOrFilter === 'string' ? idOrFilter : idOrFilter._id;
    return Promise.resolve(users.get(id) ?? null);
  });
  userFind.mockImplementation((filter: { _id?: string }) =>
    Promise.resolve([...users.values()].filter((u) => !filter._id || u._id === filter._id))
  );
  recordFindOne.mockImplementation((filter: { appUserId: string }) => {
    const own = recordsByUser.get(filter.appUserId);
    const last = own && own.length > 0 ? own[own.length - 1] : null;
    return { sort: () => Promise.resolve(last) };
  });
  recordFind.mockReturnValue({
    sort: () => ({
      limit: () => ({
        then: (onFulfilled: (r: unknown) => unknown) =>
          Promise.resolve([{ angle: 45 }, { angle: 55 }]).then(onFulfilled),
      }),
    }),
  });
});

const setUser = (user: StoredUser): StoredUser => {
  users.set(user._id, { save: vi.fn().mockResolvedValue(undefined), ...user });
  return user;
};

const batch = (appUserId: string, count: number): any => ({
  neckAngleRecords: Array.from({ length: count }, (_, i) => ({
    appUserId,
    angle: 40 + i,
    dateTimeRecorded: `2026-08-1${i}T10:00:00Z`,
  })),
});

describe('postBatchNeckAngleRecordAsync — prompt-gated average-angle push', () => {
  it('sends the average-angle report when the counter crosses the user\u2019s prompt', async () => {
    users.set('u1', {
      _id: 'u1',
      prompt: 2,
      fcmToken: TOKEN,
      allowPushNotifications: true,
      save: vi.fn().mockResolvedValue(undefined),
    });
    userUpdateOne.mockResolvedValue({});
    compareAverage.mockResolvedValue(['Your Neck Angle is Good! 🙂👏', 'body text']);

    const ok = await NeckAngleService.postBatchNeckAngleRecordAsync(batch('u1', 2));

    expect(ok).toBe(true);
    expect(sendPush).toHaveBeenCalledTimes(1);
    expect(sendPush).toHaveBeenCalledWith(
      expect.objectContaining({
        to: TOKEN,
        title: 'Your Neck Angle is Good! 🙂👏',
        data: { type: 'average_angle_report' },
      })
    );
    expect(compareAverage).toHaveBeenCalled();
  });

  it('does not push until the counter reaches a multiple of the prompt', async () => {
    setUser({ _id: 'u1', prompt: 5, fcmToken: TOKEN, allowPushNotifications: true });
    userUpdateOne.mockResolvedValue({});
    compareAverage.mockResolvedValue(['title', 'body']);

    await NeckAngleService.postBatchNeckAngleRecordAsync(batch('u1', 2));

    expect(sendPush).not.toHaveBeenCalled();
  });

  it('falls back to the default prompt of 5 for users without one', async () => {
    setUser({ _id: 'u1', fcmToken: TOKEN, allowPushNotifications: true });
    userUpdateOne.mockResolvedValue({});
    compareAverage.mockResolvedValue(['title', 'body']);

    await NeckAngleService.postBatchNeckAngleRecordAsync(batch('u1', 5));

    expect(sendPush).toHaveBeenCalledTimes(1);
  });

  it('counts records per user (not globally) so prompt=1 pushes every record', async () => {
    setUser({ _id: 'u1', prompt: 1, fcmToken: TOKEN, allowPushNotifications: true });
    userUpdateOne.mockResolvedValue({});
    compareAverage.mockResolvedValue(['title', 'body']);

    await NeckAngleService.postBatchNeckAngleRecordAsync(batch('u1', 3));

    expect(sendPush).toHaveBeenCalledTimes(3);
  });

  it('keeps counters isolated so a batch for two users pushes each exactly once', async () => {
    setUser({ _id: 'u1', prompt: 2, fcmToken: TOKEN, allowPushNotifications: true });
    setUser({ _id: 'u2', prompt: 2, fcmToken: OTHER_TOKEN, allowPushNotifications: true });
    userUpdateOne.mockResolvedValue({});
    compareAverage.mockResolvedValue(['title', 'body']);

    const ok = await NeckAngleService.postBatchNeckAngleRecordAsync({
      appUserId: 'u1',
      angles: 0,
      neckAngleRecords: [...batch('u1', 2).neckAngleRecords, ...batch('u2', 2).neckAngleRecords],
    });

    expect(ok).toBe(true);
    expect(sendPush).toHaveBeenCalledTimes(2);
    expect(sendPush).toHaveBeenCalledWith(expect.objectContaining({ to: TOKEN }));
    expect(sendPush).toHaveBeenCalledWith(expect.objectContaining({ to: OTHER_TOKEN }));
  });

  it('skips the push (without crashing) when the user has no fcmToken', async () => {
    setUser({ _id: 'u1', prompt: 1, allowPushNotifications: true });
    userUpdateOne.mockResolvedValue({});
    compareAverage.mockResolvedValue(['title', 'body']);

    const ok = await NeckAngleService.postBatchNeckAngleRecordAsync(batch('u1', 1));

    expect(ok).toBe(true);
    expect(sendPush).not.toHaveBeenCalled();
  });

  it('does not blow up when notificationCount exceeds the prompt', async () => {
    setUser({
      _id: 'u1',
      prompt: 1,
      notificationCount: 9,
      fcmToken: TOKEN,
      allowPushNotifications: true,
    });
    userUpdateOne.mockResolvedValue({});
    compareAverage.mockResolvedValue(['title', 'body']);
    sendPush.mockResolvedValue(true);

    await expect(NeckAngleService.postBatchNeckAngleRecordAsync(batch('u1', 1))).resolves.toBe(
      true
    );
  });
});

it('retains readings in the sixth partial week of a month', async () => {
  const result = await NeckAngleService.getEachWeekOfTheMonthAverageNeckAngle([
    { angle: 20, dateTimeRecorded: new Date('2026-03-30T23:30:00Z') },
    { angle: 40, dateTimeRecorded: new Date('2026-03-31T23:30:00Z') },
  ]);
  expect(result.find(row => row.week === 6)?.averageNeckAngle).toBe(30);
});
