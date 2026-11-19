import { describe, it, expect, vi, beforeEach } from 'vitest';

const userFindOneAndUpdate = vi.fn();
const userFind = vi.fn();
const userUpdateOne = vi.fn();
const userExists = vi.fn();
const userAggregate = vi.fn();
const recordFindOne = vi.fn();
const recordFind = vi.fn();
const recordInsertMany = vi.fn();
const compareAverage = vi.fn();
const sendPush = vi.fn();
const responseRateSave = vi.fn();

interface StoredUser {
  _id: string;
  prompt?: number;
  fcmToken?: string;
  allowPushNotifications?: boolean;
  notificationCount?: number;
  neckAngleRecordCounter?: number;
  save?: (...args: unknown[]) => Promise<unknown>;
}

interface StoredRecord {
  appUserId: string;
  angle: number;
  counter: number;
  dateTimeRecorded: Date;
}

// Miniature database: records and users keyed per user id so counters never
// leak between users. The user lookups the service makes (the atomic counter
// reservation and the push-time find) read the same store — a user without a
// token is tokenless in both.
const users = new Map<string, StoredUser>();
const recordsByUser = new Map<string, StoredRecord[]>();
const embeddedCounters = new Map<string, number>();

const chain = <T>(value: () => T) => {
  const query: any = {
    sort: () => query,
    limit: (n: number) => {
      query.limitTo = n;
      return query;
    },
    select: () => query,
    lean: () => Promise.resolve(value.call(query)),
  };
  return query;
};

vi.mock('../../../src/models/AppUser', () => ({
  default: {
    findOneAndUpdate: (...args: unknown[]) => userFindOneAndUpdate(...args),
    find: (...args: unknown[]) => userFind(...args),
    updateOne: (...args: unknown[]) => userUpdateOne(...args),
    exists: (...args: unknown[]) => userExists(...args),
    aggregate: (...args: unknown[]) => userAggregate(...args),
  },
}));

vi.mock('../../../src/models/NeckAngleRecord', () => ({
  NeckAngleRecordModel: {
    findOne: (...args: unknown[]) => recordFindOne(...args),
    find: (...args: unknown[]) => recordFind(...args),
    insertMany: (...args: unknown[]) => recordInsertMany(...args),
  },
}));

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

/** Newest first, as the index-backed sort({ dateTimeRecorded: -1 }) returns them. */
const newestFirst = (appUserId: string) =>
  [...(recordsByUser.get(appUserId) ?? [])].sort(
    (a, b) => b.dateTimeRecorded.getTime() - a.dateTimeRecorded.getTime()
  );

beforeEach(() => {
  vi.clearAllMocks();
  users.clear();
  recordsByUser.clear();
  embeddedCounters.clear();

  responseRateSave.mockResolvedValue(undefined);
  userUpdateOne.mockImplementation((filter: any, update: any) => {
    const user = users.get(filter._id);
    const expectsMissingOrInvalidCounter = filter.neckAngleRecordCounter?.$not?.$type === 'number';
    const matches = Boolean(user && (!expectsMissingOrInvalidCounter || typeof user.neckAngleRecordCounter !== 'number'));
    if (matches && update.$set?.neckAngleRecordCounter !== undefined) {
      user!.neckAngleRecordCounter = update.$set.neckAngleRecordCounter;
    }
    if (matches && update.$inc?.neckAngleRecordCounter) {
      user!.neckAngleRecordCounter =
        (user!.neckAngleRecordCounter ?? 0) + update.$inc.neckAngleRecordCounter;
    }
    return Promise.resolve({ modifiedCount: matches ? 1 : 0, matchedCount: matches ? 1 : 0 });
  });

  // Atomic $inc with returnDocument: 'before' — applied synchronously, so two
  // concurrent calls observe each other exactly as MongoDB serialises them.
  userFindOneAndUpdate.mockImplementation((filter: any, update: any) => {
    const user = users.get(filter._id);
    const expectsNumber = filter.neckAngleRecordCounter?.$type === 'number';
    const expectsNonNumber = filter.neckAngleRecordCounter?.$not?.$type === 'number';
    const matches = Boolean(
      user &&
      (!expectsNumber || typeof user.neckAngleRecordCounter === 'number') &&
      (!expectsNonNumber || typeof user.neckAngleRecordCounter !== 'number')
    );
    let result = matches
      ? { prompt: user!.prompt, neckAngleRecordCounter: user!.neckAngleRecordCounter }
      : null;
    if (matches && update.$inc?.neckAngleRecordCounter) {
      user!.neckAngleRecordCounter =
        (user!.neckAngleRecordCounter ?? 0) + update.$inc.neckAngleRecordCounter;
    } else if (matches && update.$set?.neckAngleRecordCounter !== undefined) {
      user!.neckAngleRecordCounter = update.$set.neckAngleRecordCounter;
      result = { prompt: user!.prompt, neckAngleRecordCounter: user!.neckAngleRecordCounter };
    }
    return chain(() => result);
  });
  userFind.mockImplementation((filter: { _id?: string }) =>
    Promise.resolve([...users.values()].filter((u) => !filter._id || u._id === filter._id))
  );
  userExists.mockImplementation((filter: { _id: string }) => Promise.resolve(users.has(filter._id)));
  userAggregate.mockImplementation((pipeline: any[]) => {
    const id = pipeline[0].$match._id.toString();
    return Promise.resolve([{ maxCounter: embeddedCounters.get(id) ?? 0 }]);
  });

  recordInsertMany.mockImplementation((docs: StoredRecord[]) => {
    for (const doc of docs) {
      const list = recordsByUser.get(doc.appUserId) ?? [];
      list.push({ ...doc, dateTimeRecorded: new Date(doc.dateTimeRecorded) });
      recordsByUser.set(doc.appUserId, list);
    }
    return Promise.resolve(docs);
  });
  recordFindOne.mockImplementation((filter: { appUserId: string }) =>
    chain(() => [...(recordsByUser.get(filter.appUserId) ?? [])].sort((a, b) => b.counter - a.counter)[0] ?? null)
  );
  recordFind.mockImplementation((filter: { appUserId: string }) =>
    chain(function (this: { limitTo?: number }) {
      return [...(recordsByUser.get(filter.appUserId) ?? [])]
        .sort((a, b) => b.counter - a.counter)
        .slice(0, this.limitTo);
    })
  );
});

describe('neck-angle service request bounds', () => {
  it('rejects an over-limit batch before performing user or record queries', async () => {
    const records = Array.from({ length: 101 }, () => ({
      appUserId: 'u1',
      angle: 45,
      dateTimeRecorded: new Date(),
    }));

    await expect(
      NeckAngleService.postBatchNeckAngleRecordAsync({ neckAngleRecords: records })
    ).rejects.toThrow('Invalid neck-angle batch size');

    expect(userFindOneAndUpdate).not.toHaveBeenCalled();
    expect(recordInsertMany).not.toHaveBeenCalled();
  });

  it('validates every record before starting database work', async () => {
    const records = [
      { appUserId: 'u1', angle: 45, dateTimeRecorded: new Date() },
      { appUserId: 'u1', angle: Number.NaN, dateTimeRecorded: new Date() },
    ];

    await expect(
      NeckAngleService.postBatchNeckAngleRecordAsync({ neckAngleRecords: records })
    ).rejects.toThrow('Invalid neck-angle record');

    expect(userFindOneAndUpdate).not.toHaveBeenCalled();
  });

  it('rejects invalid random batch inputs before inserting records', async () => {
    await expect(
      NeckAngleService.postRandomBatchNeckAngleRecordForTestAsync({
        appUserId: 'u1',
        startDate: new Date('2026-10-02T00:00:00Z'),
        endDate: new Date('2026-10-01T00:00:00Z'),
        numberOfRecords: 1,
      })
    ).rejects.toThrow('Invalid random neck-angle batch request');
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

it('averages the returned samples and does not overwrite response rate', async () => {
  setUser({ _id: 'u1', fcmToken: TOKEN });
  recordsByUser.set('u1', [
    { appUserId: 'u1', angle: 45, counter: 1, dateTimeRecorded: new Date() },
    { appUserId: 'u1', angle: 55, counter: 2, dateTimeRecorded: new Date() },
  ]);
  expect(await NeckAngleService.calculateAverageOfLastSetNeckAngles('u1')).toBe(50);
  expect(userUpdateOne).not.toHaveBeenCalled();
});
it('uses the default prompt for existing signup accounts with zero', async () => {
  setUser({ _id: 'u1', prompt: 0, neckAngleRecordCounter: 0, fcmToken: TOKEN, allowPushNotifications: true });
  compareAverage.mockResolvedValue(['title', 'body']);
  await NeckAngleService.postBatchNeckAngleRecordAsync(batch('u1', 5));
  expect(sendPush).toHaveBeenCalledTimes(1);
});

// B12: fixed query count, no duplication into AppUser, atomic counters.
describe('postBatchNeckAngleRecordAsync — B12 batch insert', () => {
  const seedRecords = (appUserId: string, angles: number[]) => {
    recordsByUser.set(
      appUserId,
      angles.map((angle, i) => ({
        appUserId,
        angle,
        counter: i + 1,
        dateTimeRecorded: new Date(Date.UTC(2026, 7, 1, 10, i)),
      }))
    );
  };
  const timedBatch = (appUserId: string, angles: number[]): any => ({
    neckAngleRecords: angles.map((angle, i) => ({
      appUserId,
      angle,
      dateTimeRecorded: new Date(Date.UTC(2026, 7, 2, 10, i)).toISOString(),
    })),
  });

  it('uses a fixed number of queries however large the batch is', async () => {
    setUser({ _id: 'u1', prompt: 100, fcmToken: TOKEN, neckAngleRecordCounter: 0 });

    await NeckAngleService.postBatchNeckAngleRecordAsync(
      timedBatch('u1', Array.from({ length: 30 }, () => 45))
    );

    expect(userFindOneAndUpdate).toHaveBeenCalledTimes(1);
    expect(recordInsertMany).toHaveBeenCalledTimes(1);
    expect(recordInsertMany.mock.calls[0][0]).toHaveLength(30);
    expect(recordInsertMany.mock.calls[0][1]).toEqual({ ordered: true });
    expect(recordFind).not.toHaveBeenCalled(); // no threshold crossed → no history read
  });

  it('never $pushes readings into the user document', async () => {
    setUser({ _id: 'u1', prompt: 1, fcmToken: TOKEN, neckAngleRecordCounter: 0 });
    compareAverage.mockResolvedValue(['title', 'body']);

    await NeckAngleService.postBatchNeckAngleRecordAsync(batch('u1', 3));

    const updates = [
      ...userUpdateOne.mock.calls.map((c) => c[1]),
      ...userFindOneAndUpdate.mock.calls.map((c) => c[1]),
    ];
    expect(updates.some((u) => '$push' in u)).toBe(false);
    expect(recordsByUser.get('u1')).toHaveLength(3);
  });

  it('reserves one contiguous block of counters with an atomic $inc', async () => {
    setUser({ _id: 'u1', prompt: 0, neckAngleRecordCounter: 7 });

    await NeckAngleService.postBatchNeckAngleRecordAsync(batch('u1', 3));

    expect(userFindOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'u1', neckAngleRecordCounter: { $type: 'number' } },
      { $inc: { neckAngleRecordCounter: 3 } },
      expect.objectContaining({ returnDocument: 'before' })
    );
    expect(recordInsertMany.mock.calls[0][0].map((d: StoredRecord) => d.counter)).toEqual([
      8, 9, 10,
    ]);
  });

  it('gives concurrent batches from one device disjoint counters', async () => {
    setUser({ _id: 'u1', prompt: 0, neckAngleRecordCounter: 0 });

    await Promise.all([
      NeckAngleService.postBatchNeckAngleRecordAsync(batch('u1', 3)),
      NeckAngleService.postBatchNeckAngleRecordAsync(batch('u1', 2)),
    ]);

    const counters = (recordsByUser.get('u1') ?? []).map((r) => r.counter).sort((a, b) => a - b);
    expect(counters).toEqual([1, 2, 3, 4, 5]);
  });

  it('continues an unmigrated user’s counter from the highest stored counter', async () => {
    setUser({ _id: 'u1', prompt: 0 }); // no neckAngleRecordCounter yet
    seedRecords('u1', Array.from({ length: 41 }, () => 50));

    await NeckAngleService.postBatchNeckAngleRecordAsync(timedBatch('u1', [60, 61]));

    expect(userFindOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'u1', neckAngleRecordCounter: { $not: { $type: 'number' } } },
      { $set: { neckAngleRecordCounter: 41 } },
      expect.objectContaining({ returnDocument: 'after' })
    );
    expect(recordInsertMany.mock.calls[0][0].map((d: StoredRecord) => d.counter)).toEqual([42, 43]);
    expect(users.get('u1')?.neckAngleRecordCounter).toBe(43);
  });

  it('uses legacy embedded counters when the new records collection is empty', async () => {
    setUser({ _id: 'u1', prompt: 0 });
    embeddedCounters.set('u1', 66);

    await NeckAngleService.postBatchNeckAngleRecordAsync(timedBatch('u1', [60]));

    expect(recordInsertMany.mock.calls[0][0].map((doc: StoredRecord) => doc.counter)).toEqual([67]);
    expect(users.get('u1')?.neckAngleRecordCounter).toBe(67);
  });

  it('serializes first-time counter seeding when two batches arrive together', async () => {
    setUser({ _id: 'u1', prompt: 0 });
    seedRecords('u1', Array.from({ length: 41 }, () => 50));

    await Promise.all([
      NeckAngleService.postBatchNeckAngleRecordAsync(timedBatch('u1', [60, 61])),
      NeckAngleService.postBatchNeckAngleRecordAsync(timedBatch('u1', [62, 63])),
    ]);

    const counters = (recordsByUser.get('u1') ?? []).map((record) => record.counter).sort((a, b) => a - b);
    expect(counters).toEqual(Array.from({ length: 45 }, (_, index) => index + 1));
    expect(users.get('u1')?.neckAngleRecordCounter).toBe(45);
  });

  it('skips an unknown user without writing anything', async () => {
    await expect(
      NeckAngleService.postBatchNeckAngleRecordAsync(batch('ghost', 2))
    ).resolves.toBe(true);

    expect(recordInsertMany).not.toHaveBeenCalled();
    expect(sendPush).not.toHaveBeenCalled();
  });

  it('averages each threshold over the last N readings up to that record, as the old loop did', async () => {
    const n = NeckAngleService.numberOfRecordPostBeforeSendingAverageNeckAngle;
    const prior = [10, 20, 30, 40];
    const posted = [50, 60, 70, 80];
    setUser({ _id: 'u1', prompt: 2, fcmToken: TOKEN, neckAngleRecordCounter: prior.length });
    seedRecords('u1', prior);
    compareAverage.mockResolvedValue(['title', 'body']);
    sendPush.mockResolvedValue(true);

    await NeckAngleService.postBatchNeckAngleRecordAsync(timedBatch('u1', posted));

    // Reference: what the per-record loop computed after saving counters 6 and 8.
    const all = [...prior, ...posted];
    const expectedAt = (count: number) => {
      const window = all.slice(Math.max(0, count - n), count);
      return Math.round((window.reduce((s, a) => s + a, 0) / window.length) * 10) / 10;
    };
    expect(compareAverage.mock.calls.map((c) => c[0])).toEqual([expectedAt(6), expectedAt(8)]);
    expect(sendPush).toHaveBeenCalledTimes(2);
    expect(userUpdateOne).not.toHaveBeenCalled();
  });
});
