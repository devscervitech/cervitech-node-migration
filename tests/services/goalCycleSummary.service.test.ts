import { describe, it, expect, vi, beforeEach } from 'vitest';

const sendPushNotification = vi.fn();
const findById = vi.fn();
const findOne = vi.fn();
const updateOne = vi.fn();
const recordFind = vi.fn();
const reportSave = vi.fn();

vi.mock('../../src/models/Goal', () => ({
  Goal: {
    find: vi.fn(),
    findOne: (...args: unknown[]) => findOne(...args),
    updateOne: (...args: unknown[]) => updateOne(...args),
  },
}));

vi.mock('../../src/models/AppUser', () => ({
  default: { findById: (...args: unknown[]) => findById(...args) },
}));

vi.mock('../../src/models/NeckAngleRecord', () => ({
  NeckAngleRecordModel: { find: (...args: unknown[]) => recordFind(...args) },
}));

vi.mock('../../src/models/GoalCycleCompletionReport', () => ({
  GoalCycleCompletionReport: vi.fn(function (this: any, fields: unknown) {
    Object.assign(this, fields as object);
    this.save = reportSave;
  }),
}));

vi.mock('../../src/services/pushNotificationDriver', () => ({
  PushNotificationDriver: {
    sendPushNotification: (...args: unknown[]) => sendPushNotification(...args),
  },
}));

import { Goal } from '../../src/models/Goal';
import AppUser from '../../src/models/AppUser';
import { NeckAngleRecordModel } from '../../src/models/NeckAngleRecord';
import { GoalCycleCompletionReport } from '../../src/models/GoalCycleCompletionReport';
import { runGoalCycleSummary } from '../../src/services/goalCycleSummary.service';

const NOW = new Date('2026-08-17T08:00:00Z');
const CYCLE_END = new Date('2026-08-16T23:59:59.999Z');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('runGoalCycleSummary', () => {
  it('concludes a due weekly goal: report saved, marker advanced, scorecard push sent', async () => {
    const goal = {
      _id: 'g1',
      appUserId: 'u1',
      targetedAverageNeckAngle: 80,
      frequency: 'WEEKLY',
      dateSet: new Date('2026-08-10T14:30:00Z'),
      nextCycleEndsAt: CYCLE_END,
    };
    (Goal.find as ReturnType<typeof vi.fn>).mockImplementation((criteria: unknown) =>
      criteria && (criteria as { nextCycleEndsAt?: { $exists?: boolean } }).nextCycleEndsAt?.$exists
        ? [goal]
        : []
    );
    findById.mockResolvedValue({
      _id: 'u1',
      isGoalOn: true,
      fcmToken: 'ExponentPushToken[abc]',
      allowPushNotifications: true,
    });
    findOne.mockReturnValue({
      sort: () => ({ select: () => Promise.resolve({ _id: 'g1' }) }),
    });
    recordFind.mockResolvedValue([
      { angle: 70, dateTimeRecorded: new Date('2026-08-12T10:00:00Z') },
      { angle: 90, dateTimeRecorded: new Date('2026-08-15T10:00:00Z') },
    ]);
    updateOne.mockResolvedValue({});

    const concluded = await runGoalCycleSummary(NOW);

    expect(concluded).toBe(1);
    expect(GoalCycleCompletionReport).toHaveBeenCalledWith({
      actualAverageNeckAngle: 80,
      complianceInPercentage: 100,
      dateOfConcludedCycle: CYCLE_END,
      goalId: 'g1',
    });
    expect(reportSave).toHaveBeenCalled();
    expect(updateOne).toHaveBeenCalledWith(
      { _id: 'g1' },
      { $set: { nextCycleEndsAt: new Date('2026-08-23T23:59:59.999Z') } }
    );
    expect(sendPushNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'ExponentPushToken[abc]',
        title: 'Your goal report 🎯',
        body: 'You scored 100/100 this week — keep it up!',
        data: { type: 'goal_cycle_report', frequency: 'WEEKLY' },
      })
    );
    expect(recordFind).toHaveBeenCalledWith({
      appUserId: 'u1',
      dateTimeRecorded: { $gte: new Date('2026-08-09T23:59:59.999Z'), $lt: CYCLE_END },
    });
  });

  it('skips users whose goal is turned off: no report, no push', async () => {
    (Goal.find as ReturnType<typeof vi.fn>).mockImplementation((criteria: unknown) =>
      criteria && (criteria as { nextCycleEndsAt?: { $exists?: boolean } }).nextCycleEndsAt?.$exists
        ? [
            {
              _id: 'g1',
              appUserId: 'u1',
              targetedAverageNeckAngle: 80,
              frequency: 'WEEKLY',
              dateSet: new Date('2026-08-10T14:30:00Z'),
              nextCycleEndsAt: CYCLE_END,
            },
          ]
        : []
    );
    findById.mockResolvedValue({
      _id: 'u1',
      isGoalOn: false,
      fcmToken: 'ExponentPushToken[abc]',
      allowPushNotifications: true,
    });

    const concluded = await runGoalCycleSummary(NOW);

    expect(concluded).toBe(0);
    expect(GoalCycleCompletionReport).not.toHaveBeenCalled();
    expect(updateOne).not.toHaveBeenCalled();
    expect(sendPushNotification).not.toHaveBeenCalled();
  });

  it('skips a stale goal that is not the user\u2019s latest: no report, no push', async () => {
    (Goal.find as ReturnType<typeof vi.fn>).mockImplementation((criteria: unknown) =>
      criteria && (criteria as { nextCycleEndsAt?: { $exists?: boolean } }).nextCycleEndsAt?.$exists
        ? [
            {
              _id: 'g1',
              appUserId: 'u1',
              targetedAverageNeckAngle: 80,
              frequency: 'WEEKLY',
              dateSet: new Date('2026-08-10T14:30:00Z'),
              nextCycleEndsAt: CYCLE_END,
            },
          ]
        : []
    );
    findById.mockResolvedValue({
      _id: 'u1',
      isGoalOn: true,
      fcmToken: 'ExponentPushToken[abc]',
      allowPushNotifications: true,
    });
    findOne.mockReturnValue({ sort: () => ({ select: () => Promise.resolve({ _id: 'g2' }) }) });

    const concluded = await runGoalCycleSummary(NOW);

    expect(concluded).toBe(0);
    expect(GoalCycleCompletionReport).not.toHaveBeenCalled();
  });

  it('writes the report and advances the marker even when the user has no token (push skipped)', async () => {
    const goal = {
      _id: 'g1',
      appUserId: 'u1',
      targetedAverageNeckAngle: 80,
      frequency: 'DAILY',
      dateSet: new Date('2026-08-13T14:30:00Z'),
      nextCycleEndsAt: new Date('2026-08-13T23:59:59.999Z'),
    };
    (Goal.find as ReturnType<typeof vi.fn>).mockImplementation((criteria: unknown) =>
      criteria && (criteria as { nextCycleEndsAt?: { $exists?: boolean } }).nextCycleEndsAt?.$exists
        ? [goal]
        : []
    );
    findById.mockResolvedValue({
      _id: 'u1',
      isGoalOn: true,
      fcmToken: undefined,
      allowPushNotifications: true,
    });
    findOne.mockReturnValue({ sort: () => ({ select: () => Promise.resolve({ _id: 'g1' }) }) });
    recordFind.mockResolvedValue([
      { angle: 80, dateTimeRecorded: new Date('2026-08-13T10:00:00Z') },
    ]);

    const concluded = await runGoalCycleSummary(NOW);

    expect(concluded).toBe(1);
    expect(GoalCycleCompletionReport).toHaveBeenCalledWith({
      actualAverageNeckAngle: 80,
      complianceInPercentage: 100,
      dateOfConcludedCycle: new Date('2026-08-13T23:59:59.999Z'),
      goalId: 'g1',
    });
    expect(updateOne).toHaveBeenCalledWith(
      { _id: 'g1' },
      { $set: { nextCycleEndsAt: new Date('2026-08-14T23:59:59.999Z') } }
    );
    expect(sendPushNotification).not.toHaveBeenCalled();
  });

  it('concludes a cycle with zero records as a 0/100 scorecard', async () => {
    const goal = {
      _id: 'g1',
      appUserId: 'u1',
      targetedAverageNeckAngle: 80,
      frequency: 'DAILY',
      dateSet: new Date('2026-08-13T14:30:00Z'),
      nextCycleEndsAt: new Date('2026-08-13T23:59:59.999Z'),
    };
    (Goal.find as ReturnType<typeof vi.fn>).mockImplementation((criteria: unknown) =>
      criteria && (criteria as { nextCycleEndsAt?: { $exists?: boolean } }).nextCycleEndsAt?.$exists
        ? [goal]
        : []
    );
    findById.mockResolvedValue({
      _id: 'u1',
      isGoalOn: true,
      fcmToken: 'ExponentPushToken[abc]',
      allowPushNotifications: true,
    });
    findOne.mockReturnValue({ sort: () => ({ select: () => Promise.resolve({ _id: 'g1' }) }) });
    recordFind.mockResolvedValue([]);

    const concluded = await runGoalCycleSummary(NOW);

    expect(concluded).toBe(1);
    expect(GoalCycleCompletionReport).toHaveBeenCalledWith({
      actualAverageNeckAngle: 0,
      complianceInPercentage: 0,
      dateOfConcludedCycle: new Date('2026-08-13T23:59:59.999Z'),
      goalId: 'g1',
    });
    expect(sendPushNotification).toHaveBeenCalledWith(
      expect.objectContaining({ body: 'You scored 0/100 today — keep it up!' })
    );
  });

  it('initialises legacy goals (no marker) at the most recent concluded cycle end', async () => {
    const legacyGoal = {
      _id: 'g1',
      appUserId: 'u1',
      targetedAverageNeckAngle: 80,
      frequency: 'WEEKLY',
      dateSet: new Date('2026-07-13T14:30:00Z'), // 5 weeks before NOW
    };
    (Goal.find as ReturnType<typeof vi.fn>).mockImplementation((criteria: unknown) =>
      criteria && (criteria as { nextCycleEndsAt?: { $exists?: boolean } }).nextCycleEndsAt?.$exists
        ? []
        : [legacyGoal]
    );
    findById.mockResolvedValue({
      _id: 'u1',
      isGoalOn: true,
      fcmToken: 'ExponentPushToken[abc]',
      allowPushNotifications: true,
    });
    findOne.mockReturnValue({ sort: () => ({ select: () => Promise.resolve({ _id: 'g1' }) }) });
    recordFind.mockResolvedValue([
      { angle: 72, dateTimeRecorded: new Date('2026-08-12T10:00:00Z') },
    ]);

    const concluded = await runGoalCycleSummary(NOW);

    expect(concluded).toBe(1);
    const reportArgs = (GoalCycleCompletionReport as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(new Date(reportArgs.dateOfConcludedCycle).toISOString()).toBe(
      '2026-08-16T23:59:59.999Z'
    );
    expect(reportArgs.complianceInPercentage).toBe(90);
    expect(updateOne).toHaveBeenCalledWith(
      { _id: 'g1' },
      { $set: { nextCycleEndsAt: new Date('2026-08-23T23:59:59.999Z') } }
    );
  });

  it('does nothing when no goals are due', async () => {
    (Goal.find as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const concluded = await runGoalCycleSummary(NOW);

    expect(concluded).toBe(0);
    expect(GoalCycleCompletionReport).not.toHaveBeenCalled();
    expect(sendPushNotification).not.toHaveBeenCalled();
  });
});
