import { describe, it, expect, vi, beforeEach } from 'vitest';

let candidates: any[] = [];
const userFind = vi.fn();
const userUpdateMany = vi.fn();
const recordDistinct = vi.fn();
const recordAggregate = vi.fn();
const sendBatch = vi.fn();

vi.mock('../../src/models/AppUser', () => ({
  default: {
    find: (...args: unknown[]) => userFind(...args),
    updateMany: (...args: unknown[]) => userUpdateMany(...args),
  },
}));

vi.mock('../../src/models/NeckAngleRecord', () => ({
  NeckAngleRecordModel: {
    distinct: (...args: unknown[]) => recordDistinct(...args),
    aggregate: (...args: unknown[]) => recordAggregate(...args),
  },
}));

vi.mock('../../src/services/pushNotificationDriver', () => ({
  PushNotificationDriver: { sendBatch: (...args: unknown[]) => sendBatch(...args) },
}));

vi.mock('../../src/jobs/jobLock', () => ({ scheduleExclusiveJob: vi.fn() }));

import {
  CANDIDATE_CHUNK_SIZE,
  HAS_PUSH_TOKEN,
  runBadPostureAlert,
  runCheckInReminder,
  runGoalProgressReminder,
  runGoalReminder,
} from '../../src/jobs/pushReminders.job';

const NOW = new Date('2026-11-19T17:00:00Z');
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 60 * 60 * 1000);
const user = (id: string, extra: Record<string, unknown> = {}) => ({
  _id: id,
  fcmToken: `ExponentPushToken[${id}]`,
  ...extra,
});

beforeEach(() => {
  vi.clearAllMocks();
  candidates = [];
  userFind.mockImplementation(() => {
    const query: any = {
      select: () => query,
      lean: () => query,
      cursor: () => ({
        async *[Symbol.asyncIterator]() {
          yield* candidates;
        },
        close: vi.fn(async () => undefined),
      }),
    };
    return query;
  });
  userUpdateMany.mockResolvedValue({});
  recordDistinct.mockResolvedValue([]);
  recordAggregate.mockResolvedValue([]);
  sendBatch.mockImplementation(async (messages: unknown[]) => ({
    delivered: messages.map(() => true),
    ticketIds: messages.map(() => 't'),
  }));
});

describe('push reminder jobs — candidate filters', () => {
  const runs = [runGoalReminder, runCheckInReminder, runGoalProgressReminder, runBadPostureAlert];

  it('treats the empty token that logout writes as "no token" in every job', async () => {
    for (const run of runs) await run(NOW);

    expect(userFind).toHaveBeenCalledTimes(4);
    for (const [filter] of userFind.mock.calls) {
      expect(filter.fcmToken).toEqual({ $type: 'string', $gt: '' });
      expect(filter.deleted).toEqual({ $ne: true });
      expect(filter.allowPushNotifications).toBe(true);
    }
    expect(HAS_PUSH_TOKEN).toEqual({ $type: 'string', $gt: '' });
  });

  it('applies the per-user cooldown in the query instead of after loading everyone', async () => {
    await runGoalReminder(NOW);
    await runBadPostureAlert(NOW);

    expect(userFind.mock.calls[0][0].$or).toEqual([
      { lastGoalReminderSentAt: null },
      { lastGoalReminderSentAt: { $lt: hoursAgo(72) } },
    ]);
    expect(userFind.mock.calls[1][0].$or).toEqual([
      { lastBadPostureAlertSentAt: null },
      { lastBadPostureAlertSentAt: { $lt: hoursAgo(3) } },
    ]);
  });
});

describe('runGoalReminder', () => {
  it('pushes every candidate and stamps only the ones Expo accepted', async () => {
    candidates = [user('u1'), user('u2')];
    sendBatch.mockResolvedValue({ delivered: [true, false], ticketIds: ['t', null] });

    const summary = await runGoalReminder(NOW);

    expect(summary).toEqual({ due: 2, sent: 1 });
    expect(sendBatch.mock.calls[0][0]).toHaveLength(2);
    expect(userUpdateMany).toHaveBeenCalledWith(
      { _id: { $in: ['u1'] } },
      { $set: { lastGoalReminderSentAt: NOW } }
    );
  });
});

describe('runCheckInReminder', () => {
  it('finds recent check-ins with one query per chunk, not one per user', async () => {
    candidates = [user('u1', { isGoalOn: true }), user('u2'), user('u3')];
    recordDistinct.mockResolvedValue(['u2']); // u2 checked in within 24h

    const summary = await runCheckInReminder(NOW);

    expect(recordDistinct).toHaveBeenCalledTimes(1);
    expect(recordDistinct).toHaveBeenCalledWith('appUserId', {
      appUserId: { $in: ['u1', 'u2', 'u3'] },
      dateTimeRecorded: { $gt: hoursAgo(24) },
    });
    expect(summary).toEqual({ due: 2, sent: 2 });
    const messages = sendBatch.mock.calls[0][0];
    expect(messages.map((m: any) => m.to)).toEqual(['ExponentPushToken[u1]', 'ExponentPushToken[u3]']);
    expect(messages[0].title).toBe("It's been a while 👋"); // goal-on copy
    expect(messages[1].title).toBe('Quick neck check?');
    expect(userUpdateMany).toHaveBeenCalledWith(
      { _id: { $in: ['u1', 'u3'] } },
      { $set: { lastCheckInReminderSentAt: NOW } }
    );
  });

  it(`processes candidates in chunks of ${CANDIDATE_CHUNK_SIZE}`, async () => {
    candidates = Array.from({ length: 1200 }, (_, i) => user(`u${i}`));

    const summary = await runCheckInReminder(NOW);

    expect(recordDistinct).toHaveBeenCalledTimes(3);
    expect(recordDistinct.mock.calls.map((c) => c[1].appUserId.$in.length)).toEqual([500, 500, 200]);
    expect(sendBatch).toHaveBeenCalledTimes(3);
    expect(summary).toEqual({ due: 1200, sent: 1200 });
  });

  it('sends nothing when everyone has checked in', async () => {
    candidates = [user('u1')];
    recordDistinct.mockResolvedValue(['u1']);

    expect(await runCheckInReminder(NOW)).toEqual({ due: 0, sent: 0 });
    expect(sendBatch).not.toHaveBeenCalled();
    expect(userUpdateMany).not.toHaveBeenCalled();
  });
});

describe('runGoalProgressReminder', () => {
  const withGoals = (id: string, ...targets: [string, number][]) =>
    user(id, {
      goals: targets.map(([dateSet, targetedAverageNeckAngle]) => ({
        dateSet: new Date(dateSet),
        targetedAverageNeckAngle,
      })),
    });

  it('nudges only users trailing their latest goal over enough samples', async () => {
    candidates = [
      withGoals('behind', ['2026-01-01', 90], ['2026-06-01', 70]), // latest target 70
      withGoals('onTarget', ['2026-06-01', 60]),
      withGoals('tooFewSamples', ['2026-06-01', 80]),
      withGoals('noGoal'),
    ];
    recordAggregate.mockResolvedValue([
      { _id: 'behind', total: 65 * 4, count: 4 },
      { _id: 'onTarget', total: 65 * 4, count: 4 },
      { _id: 'tooFewSamples', total: 20 * 2, count: 2 },
    ]);

    const summary = await runGoalProgressReminder(NOW);

    // One aggregation for the chunk, only for users who have a target.
    expect(recordAggregate).toHaveBeenCalledTimes(1);
    expect(recordAggregate.mock.calls[0][0][0]).toEqual({
      $match: {
        appUserId: { $in: ['behind', 'onTarget', 'tooFewSamples'] },
        dateTimeRecorded: { $gte: new Date(NOW.getTime() - 60 * 60 * 1000) },
      },
    });
    expect(summary).toEqual({ due: 1, sent: 1 });
    expect(sendBatch.mock.calls[0][0]).toEqual([
      expect.objectContaining({
        to: 'ExponentPushToken[behind]',
        data: { type: 'goal_progress', avg: 65, target: 70 },
      }),
    ]);
    expect(userUpdateMany).toHaveBeenCalledWith(
      { _id: { $in: ['behind'] } },
      { $set: { lastGoalReminderSentAt: NOW } }
    );
  });
});

describe('runBadPostureAlert', () => {
  it('alerts when the last hour averages below the Poor cutoff', async () => {
    candidates = [user('slouching'), user('fine'), user('quiet')];
    recordAggregate.mockResolvedValue([
      { _id: 'slouching', total: 25 + 26 + 27, count: 3 },
      { _id: 'fine', total: 60 * 5, count: 5 },
    ]);

    const summary = await runBadPostureAlert(NOW);

    expect(recordAggregate).toHaveBeenCalledTimes(1);
    expect(summary).toEqual({ due: 1, sent: 1 });
    expect(sendBatch.mock.calls[0][0]).toEqual([
      expect.objectContaining({
        to: 'ExponentPushToken[slouching]',
        data: { type: 'bad_posture_alert', avg: 26 },
      }),
    ]);
    expect(userUpdateMany).toHaveBeenCalledWith(
      { _id: { $in: ['slouching'] } },
      { $set: { lastBadPostureAlertSentAt: NOW } }
    );
  });
});
