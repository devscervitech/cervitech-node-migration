import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  schedule: vi.fn(),
  findUsers: vi.fn(),
  aggregateGoals: vi.fn(),
  findRecords: vi.fn(),
  sendBatch: vi.fn(),
}));

vi.mock('node-cron', () => ({
  default: { schedule: (...args: unknown[]) => mocks.schedule(...args) },
}));

vi.mock('../../src/models/AppUser', () => ({
  default: { find: (...args: unknown[]) => mocks.findUsers(...args) },
}));

vi.mock('../../src/models/Goal', () => ({
  Goal: { aggregate: (...args: unknown[]) => mocks.aggregateGoals(...args) },
}));

vi.mock('../../src/models/NeckAngleRecord', () => ({
  NeckAngleRecordModel: { find: (...args: unknown[]) => mocks.findRecords(...args) },
}));

vi.mock('../../src/services/pushNotificationDriver', () => ({
  PushNotificationDriver: { sendBatch: (...args: unknown[]) => mocks.sendBatch(...args) },
}));

import {
  startGoalProgressJob,
  startGoalReminderJob,
} from '../../src/jobs/pushReminders.job';

function activeUser(
  lastGoalReminderSentAt?: Date,
  lastGoalProgressSentAt?: Date,
  isGoalOn = true
) {
  return {
    _id: 'user-1',
    fcmToken: 'ExponentPushToken[test]',
    isGoalOn,
    lastGoalReminderSentAt,
    lastGoalProgressSentAt,
    save: vi.fn().mockResolvedValue(undefined),
  };
}

async function runScheduledJob(): Promise<void> {
  startGoalProgressJob();
  const callback = mocks.schedule.mock.calls[0][1] as () => Promise<void>;
  await callback();
}

async function runGoalReminderJob(): Promise<void> {
  startGoalReminderJob();
  const callback = mocks.schedule.mock.calls[0][1] as () => Promise<void>;
  await callback();
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  mocks.sendBatch.mockResolvedValue({ delivered: [true] });
  mocks.findRecords.mockReturnValue({
    select: vi.fn().mockResolvedValue([{ angle: 30 }, { angle: 35 }, { angle: 40 }]),
  });
});

describe('goal progress reminder job', () => {
  it('uses the newest Goal target even when the separate goal-reminder cooldown is recent', async () => {
    const user = activeUser(new Date());
    mocks.findUsers.mockResolvedValue([user]);
    mocks.aggregateGoals.mockReturnValue({
      exec: vi.fn().mockResolvedValue([
        { _id: 'goal-1', appUserId: 'user-1', targetedAverageNeckAngle: 60 },
      ]),
    });

    await runScheduledJob();

    expect(mocks.aggregateGoals).toHaveBeenCalledWith([
      { $match: { appUserId: { $in: ['user-1'] } } },
      { $sort: { dateSet: -1, _id: -1 } },
      { $group: { _id: '$appUserId', goal: { $first: '$$ROOT' } } },
      { $replaceRoot: { newRoot: '$goal' } },
      {
        $project: {
          _id: 1,
          appUserId: 1,
          dateSet: 1,
          targetedAverageNeckAngle: 1,
          frequency: 1,
          nextCycleEndsAt: 1,
        },
      },
    ]);
    expect(mocks.findRecords).toHaveBeenCalledWith({
      appUserId: 'user-1',
      dateTimeRecorded: { $gte: expect.any(Date) },
    });
    expect(mocks.sendBatch).toHaveBeenCalledWith([
      expect.objectContaining({
        to: 'ExponentPushToken[test]',
        data: { type: 'goal_progress', avg: 35, target: 60 },
      }),
    ]);
    expect(user.lastGoalProgressSentAt).toBeInstanceOf(Date);
    expect(user.lastGoalReminderSentAt).toBeInstanceOf(Date);
    expect(user.save).toHaveBeenCalledOnce();
  });

  it('skips safely when there is no Goal document for an active user', async () => {
    const user = activeUser();
    mocks.findUsers.mockResolvedValue([user]);
    mocks.aggregateGoals.mockReturnValue({ exec: vi.fn().mockResolvedValue([]) });

    await runScheduledJob();

    expect(mocks.findRecords).not.toHaveBeenCalled();
    expect(mocks.sendBatch).not.toHaveBeenCalled();
    expect(user.save).not.toHaveBeenCalled();
  });

  it('uses only the progress cooldown field for progress reminders', async () => {
    vi.useFakeTimers();
    const now = new Date('2026-10-01T10:00:00.000Z');
    vi.setSystemTime(now);
    const user = activeUser(undefined, new Date(now.getTime() - 60 * 60 * 1000));
    mocks.findUsers.mockResolvedValue([user]);
    mocks.aggregateGoals.mockReturnValue({
      exec: vi.fn().mockResolvedValue([
        { _id: 'goal-1', appUserId: 'user-1', targetedAverageNeckAngle: 60 },
      ]),
    });

    await runScheduledJob();

    expect(mocks.sendBatch).not.toHaveBeenCalled();
    expect(mocks.findRecords).not.toHaveBeenCalled();
    expect(user.save).not.toHaveBeenCalled();
  });

  it('does not let the progress cooldown suppress the separate goal reminder', async () => {
    const user = activeUser(undefined, new Date(), false);
    mocks.findUsers.mockResolvedValue([user]);

    await runGoalReminderJob();

    expect(mocks.sendBatch).toHaveBeenCalledWith([
      expect.objectContaining({ data: { type: 'goal_reminder' } }),
    ]);
    expect(user.lastGoalReminderSentAt).toBeInstanceOf(Date);
    expect(user.lastGoalProgressSentAt).toBeInstanceOf(Date);
    expect(user.save).toHaveBeenCalledOnce();
  });
});
