import { describe, it, expect, vi, beforeEach } from 'vitest';

const findById = vi.fn();
const findOne = vi.fn();
const updateGoal = vi.fn();
const reportUpsert = vi.fn();
const recordAggregate = vi.fn();
const sendBatch = vi.fn();
const dueGoals: any[] = [];
const legacyGoals: any[] = [];
const storedGoals = new Map<string, any>();
const reports = new Map<string, any>();

const cursorFor = (items: any[]) => {
  const cursor = {
    async *[Symbol.asyncIterator]() {
      for (const item of items) yield item;
    },
    close: vi.fn(async () => undefined),
  };
  return cursor;
};

vi.mock('../../src/models/Goal', () => ({
  Goal: {
    find: vi.fn((criteria: any) => {
      const query: any = {
        select: vi.fn(() => query),
        cursor: (options: unknown) => {
          query.cursorOptions = options;
          const items = criteria.nextCycleEndsAt?.$exists ? dueGoals : legacyGoals;
          return cursorFor(items);
        },
      };
      return query;
    }),
    findOne: (...args: unknown[]) => findOne(...args),
    updateOne: (...args: unknown[]) => updateGoal(...args),
  },
}));

vi.mock('../../src/models/AppUser', () => ({
  default: { findById: (...args: unknown[]) => findById(...args) },
}));

vi.mock('../../src/models/NeckAngleRecord', () => ({
  NeckAngleRecordModel: { aggregate: (...args: unknown[]) => recordAggregate(...args) },
}));

vi.mock('../../src/models/GoalCycleCompletionReport', () => ({
  GoalCycleCompletionReport: { updateOne: (...args: unknown[]) => reportUpsert(...args) },
}));

vi.mock('../../src/services/pushNotificationDriver', () => ({
  PushNotificationDriver: { sendBatch: (...args: unknown[]) => sendBatch(...args) },
}));

import { Goal } from '../../src/models/Goal';
import AppUser from '../../src/models/AppUser';
import { NeckAngleRecordModel } from '../../src/models/NeckAngleRecord';
import { GoalCycleCompletionReport } from '../../src/models/GoalCycleCompletionReport';
import { runGoalCycleSummary } from '../../src/services/goalCycleSummary.service';

const NOW = new Date('2026-08-17T08:00:00Z');
const CYCLE_END = new Date('2026-08-16T23:59:59.999Z');

const activeUser = (id: string, token?: string, isGoalOn = true) => ({
  _id: id,
  isGoalOn,
  fcmToken: token,
  allowPushNotifications: true,
});
const dueGoal = (id = 'g1', appUserId = 'u1', extra: Record<string, unknown> = {}) => {
  const goal: any = {
    _id: id,
    appUserId,
    targetedAverageNeckAngle: 80,
    frequency: 'WEEKLY',
    dateSet: new Date('2026-08-10T14:30:00Z'),
    nextCycleEndsAt: CYCLE_END,
    ...extra,
  };
  storedGoals.set(id, goal);
  return goal;
};
const sentPushes = () => sendBatch.mock.calls.flatMap((call) => call[0] as unknown[]);

beforeEach(() => {
  vi.clearAllMocks();
  dueGoals.length = 0;
  legacyGoals.length = 0;
  storedGoals.clear();
  reports.clear();
  findById.mockResolvedValue(activeUser('u1', 'ExponentPushToken[abc]'));
  findOne.mockReturnValue({ sort: () => ({ select: () => Promise.resolve({ _id: 'g1' }) }) });
  updateGoal.mockImplementation(async (filter: any, update: any) => {
    const goal = storedGoals.get(String(filter._id));
    if (!goal) return { modifiedCount: 0 };
    const expected = filter.nextCycleEndsAt;
    const matches = expected && typeof expected === 'object' && '$exists' in expected
      ? expected.$exists === false && !goal.nextCycleEndsAt
      : goal.nextCycleEndsAt instanceof Date && goal.nextCycleEndsAt.getTime() === expected.getTime();
    if (!matches) return { modifiedCount: 0 };
    Object.assign(goal, update.$set);
    return { modifiedCount: 1 };
  });
  reportUpsert.mockImplementation(async (filter: any, update: any) => {
    const key = `${String(filter.goalId)}:${new Date(filter.dateOfConcludedCycle).toISOString()}`;
    if (reports.has(key)) return { upsertedCount: 0 };
    reports.set(key, update.$setOnInsert);
    return { upsertedCount: 1 };
  });
  recordAggregate.mockResolvedValue([]);
  sendBatch.mockResolvedValue({ delivered: [], ticketIds: [] });
});

const recordsAre = (records: { angle: number }[]) =>
  recordAggregate.mockResolvedValue(
    records.length === 0
      ? []
      : [{ _id: null, total: records.reduce((sum, record) => sum + record.angle, 0), count: records.length }]
  );

describe('runGoalCycleSummary', () => {
  it('writes the scorecard before advancing a due goal and sends the notification', async () => {
    dueGoals.push(dueGoal());
    recordsAre([{ angle: 70 }, { angle: 90 }]);

    expect(await runGoalCycleSummary(NOW)).toBe(1);

    expect(reportUpsert).toHaveBeenCalledWith(
      { goalId: 'g1', dateOfConcludedCycle: CYCLE_END },
      {
        $setOnInsert: {
          actualAverageNeckAngle: 80,
          complianceInPercentage: 100,
          dateOfConcludedCycle: CYCLE_END,
          goalId: 'g1',
        },
      },
      { upsert: true }
    );
    expect(updateGoal).toHaveBeenCalledWith(
      { _id: 'g1', nextCycleEndsAt: CYCLE_END },
      { $set: { nextCycleEndsAt: new Date('2026-08-23T23:59:59.999Z') } }
    );
    expect(sentPushes()).toContainEqual(
      expect.objectContaining({
        to: 'ExponentPushToken[abc]',
        title: 'Your goal report 🎯',
        body: 'You scored 100/100 this week — keep it up!',
        data: { type: 'goal_cycle_report', frequency: 'WEEKLY' },
      })
    );
    expect(recordAggregate.mock.calls[0][0][0]).toEqual({
      $match: {
        appUserId: 'u1',
        dateTimeRecorded: { $gte: new Date('2026-08-09T23:59:59.999Z'), $lt: CYCLE_END },
      },
    });
  });

  it('advances an inactive due goal so it is not loaded as due every day', async () => {
    dueGoals.push(dueGoal());
    findById.mockResolvedValue(activeUser('u1', 'ExponentPushToken[abc]', false));

    expect(await runGoalCycleSummary(NOW)).toBe(0);
    expect(updateGoal).toHaveBeenCalledWith(
      { _id: 'g1', nextCycleEndsAt: CYCLE_END },
      { $set: { nextCycleEndsAt: new Date('2026-08-23T23:59:59.999Z') } }
    );
    expect(reportUpsert).not.toHaveBeenCalled();
  });

  it('advances a superseded goal without creating an obsolete report', async () => {
    dueGoals.push(dueGoal());
    findOne.mockReturnValue({ sort: () => ({ select: () => Promise.resolve({ _id: 'g2' }) }) });

    expect(await runGoalCycleSummary(NOW)).toBe(0);
    expect(updateGoal).toHaveBeenCalled();
    expect(reportUpsert).not.toHaveBeenCalled();
  });

  it('keeps the durable scorecard even when the user has no push token', async () => {
    dueGoals.push(dueGoal());
    findById.mockResolvedValue(activeUser('u1'));
    recordsAre([{ angle: 80 }]);

    expect(await runGoalCycleSummary(NOW)).toBe(1);
    expect(reports.size).toBe(1);
    expect(sendBatch).not.toHaveBeenCalled();
  });

  it('records a 0 score for a cycle with no readings', async () => {
    dueGoals.push(dueGoal());
    recordsAre([]);

    expect(await runGoalCycleSummary(NOW)).toBe(1);
    expect([...reports.values()][0]).toMatchObject({
      actualAverageNeckAngle: 0,
      complianceInPercentage: 0,
    });
  });

  it('reports the most recent concluded cycle for a legacy goal and advances its marker', async () => {
    const goal = dueGoal('g1', 'u1', {
      frequency: 'WEEKLY',
      dateSet: new Date('2026-07-13T14:30:00Z'),
      nextCycleEndsAt: undefined,
    });
    delete goal.nextCycleEndsAt;
    legacyGoals.push(goal);
    recordsAre([{ angle: 72 }]);

    expect(await runGoalCycleSummary(NOW)).toBe(1);
    expect([...reports.values()][0].dateOfConcludedCycle).toEqual(CYCLE_END);
    expect(updateGoal).toHaveBeenCalledWith(
      { _id: 'g1', nextCycleEndsAt: { $exists: false } },
      { $set: { nextCycleEndsAt: new Date('2026-08-23T23:59:59.999Z') } }
    );
  });

  it('stamps a legacy goal whose first cycle has not ended without a premature report', async () => {
    const goal = dueGoal('g1', 'u1', {
      frequency: 'DAILY',
      dateSet: new Date('2026-08-17T07:00:00Z'),
      nextCycleEndsAt: undefined,
    });
    delete goal.nextCycleEndsAt;
    legacyGoals.push(goal);

    expect(await runGoalCycleSummary(NOW)).toBe(0);
    expect(reportUpsert).not.toHaveBeenCalled();
    expect(goal.nextCycleEndsAt).toEqual(new Date('2026-08-17T23:59:59.999Z'));
  });

  it('streams only supported goals with a projection and bounded cursor batch size', async () => {
    await runGoalCycleSummary(NOW);
    const calls = (Goal.find as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls).toHaveLength(2);
    for (const [filter] of calls) expect(filter.frequency).toEqual({ $in: ['DAILY', 'WEEKLY'] });
    const query = (Goal.find as ReturnType<typeof vi.fn>).mock.results[0].value;
    expect(query.cursorOptions).toEqual({ batchSize: 200 });
    expect(query.select).toHaveBeenCalledWith(
      '_id appUserId targetedAverageNeckAngle frequency dateSet nextCycleEndsAt'
    );
  });

  it('leaves a due marker unchanged if aggregation/report persistence fails so a later run retries', async () => {
    const goal = dueGoal();
    dueGoals.push(goal);
    recordAggregate.mockRejectedValue(new Error('database unavailable'));

    expect(await runGoalCycleSummary(NOW)).toBe(0);
    expect(goal.nextCycleEndsAt).toEqual(CYCLE_END);
    expect(reportUpsert).not.toHaveBeenCalled();
  });

  it('does not create a duplicate report on a retry after the report already exists', async () => {
    const goal = dueGoal();
    dueGoals.push(goal);
    const key = `g1:${CYCLE_END.toISOString()}`;
    reports.set(key, { actualAverageNeckAngle: 80, complianceInPercentage: 100 });

    expect(await runGoalCycleSummary(NOW)).toBe(1);
    expect(reports.size).toBe(1);
    expect(goal.nextCycleEndsAt).toEqual(new Date('2026-08-23T23:59:59.999Z'));
    expect(sendBatch).not.toHaveBeenCalled();
  });

  it('eventually visits all markerless legacy goals without keeping them in memory as one array', async () => {
    legacyGoals.push(
      ...Array.from({ length: 450 }, (_, index) =>
        dueGoal(`g${index}`, `u${index}`, {
          frequency: 'DAILY',
          dateSet: new Date('2026-08-15T12:00:00Z'),
          nextCycleEndsAt: undefined,
        })
      )
    );
    findById.mockImplementation(async (id: string) => activeUser(id, undefined, false));

    expect(await runGoalCycleSummary(NOW)).toBe(0);
    expect(updateGoal).toHaveBeenCalledTimes(450);
    expect(legacyGoals.every((goal) => goal.nextCycleEndsAt instanceof Date)).toBe(true);
  });

  it('does not advance a marker if another worker already changed it', async () => {
    const goal = dueGoal();
    dueGoals.push(goal);
    updateGoal.mockResolvedValue({ modifiedCount: 0 });
    recordsAre([{ angle: 80 }]);

    expect(await runGoalCycleSummary(NOW)).toBe(0);
    expect(reportUpsert).toHaveBeenCalledTimes(1);
    expect(sendBatch).not.toHaveBeenCalled();
  });
});
