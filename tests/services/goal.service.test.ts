import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  goalFind: vi.fn(),
  reportFind: vi.fn(),
  appUserFindById: vi.fn(),
  getLatestGoal: vi.fn(),
  updateGoal: vi.fn(),
  constructGoal: vi.fn(),
  saveGoal: vi.fn(),
}));
const { goalFind, reportFind } = mocks;

vi.mock('../../src/models/Goal', () => ({
  Goal: class MockGoal {
    constructor(fields: unknown) {
      mocks.constructGoal(fields);
      Object.assign(this, fields);
    }
    save() {
      return mocks.saveGoal(this);
    }
    static find(...args: unknown[]) {
      return mocks.goalFind(...args);
    }
    static updateOne(...args: unknown[]) {
      return mocks.updateGoal(...args);
    }
  },
}));

vi.mock('../../src/models/AppUser', () => ({
  default: { findById: (...args: unknown[]) => mocks.appUserFindById(...args) },
}));

// goal.service.ts imports AppUserService (unused by getAllGoalsByIdAsync,
// but still evaluated at module load) which in turn imports EmailUtils,
// whose static initializer builds a real Azure EmailClient from env vars
// that don't exist in the test environment. Stubbed out purely to avoid
// pulling that chain in — nothing in these tests touches AppUserService.
vi.mock('../../src/services/appUserServices/appUserService.service', () => ({
  AppUserService: {},
}));

vi.mock('../../src/models/GoalCycleCompletionReport', () => ({
  GoalCycleCompletionReport: {
    find: (...args: unknown[]) => reportFind(...args),
  },
}));

vi.mock('../../src/services/goalLookup.service', () => ({
  getLatestGoal: (...args: unknown[]) => mocks.getLatestGoal(...args),
}));

import { GoalService } from '../../src/services/goal.service';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.appUserFindById.mockResolvedValue(null);
  mocks.getLatestGoal.mockResolvedValue(null);
  mocks.updateGoal.mockResolvedValue({ acknowledged: true });
  mocks.saveGoal.mockResolvedValue({ _id: { toString: () => 'new-goal' } });
});

/**
 * Regression coverage for the goal-history bug: getAllGoalsByIdAsync used
 * to read `Goal.goalCycleCompletionReports` (an embedded array only ever
 * seeded once, at turn-on time, from whatever the client submitted) instead
 * of the GoalCycleCompletionReport collection that runGoalCycleSummary()
 * actually writes real concluded-cycle reports into. Every real cycle a
 * user ever completed was invisible to this endpoint as a result.
 */
describe('GoalService.getAllGoalsByIdAsync', () => {
  it('returns an empty array (not an error) for a user with no goals at all', async () => {
    goalFind.mockReturnValue({ lean: () => ({ exec: () => Promise.resolve([]) }) });

    const result = await GoalService.getAllGoalsByIdAsync('u1');

    expect(result).toEqual([]);
    expect(reportFind).not.toHaveBeenCalled();
  });

  it('returns an empty array for a user whose goal has no concluded cycles yet', async () => {
    goalFind.mockReturnValue({
      lean: () => ({
        exec: () =>
          Promise.resolve([
            { _id: 'g1', appUserId: 'u1', frequency: 'DAILY', targetedAverageNeckAngle: 80 },
          ]),
      }),
    });
    reportFind.mockReturnValue({
      sort: () => ({ lean: () => ({ exec: () => Promise.resolve([]) }) }),
    });

    const result = await GoalService.getAllGoalsByIdAsync('u1');

    expect(result).toEqual([]);
  });

  it('reads concluded-cycle reports from GoalCycleCompletionReport, not the embedded array', async () => {
    goalFind.mockReturnValue({
      lean: () => ({
        exec: () =>
          Promise.resolve([
            { _id: 'g1', appUserId: 'u1', frequency: 'DAILY', targetedAverageNeckAngle: 80 },
          ]),
      }),
    });
    reportFind.mockReturnValue({
      sort: () => ({
        lean: () => ({
          exec: () =>
            Promise.resolve([
              {
                goalId: 'g1',
                actualAverageNeckAngle: 76.2345,
                complianceInPercentage: 95.5,
                dateOfConcludedCycle: new Date('2026-08-16T23:59:59.999Z'), // a Sunday
              },
            ]),
        }),
      }),
    });

    const result = await GoalService.getAllGoalsByIdAsync('u1');

    expect(reportFind).toHaveBeenCalledWith({ goalId: { $in: ['g1'] } });
    expect(result).toEqual([
      {
        id: 1,
        appUserId: 'u1',
        frequency: 'DAILY',
        targetedAverageNeckAngle: 80,
        actualAverageNeckAngle: 76.2, // rounded to 1dp
        complianceInPercentage: 95.5,
        dateOfConcludedCycle: new Date('2026-08-16T23:59:59.999Z'),
        dayOfConcludedCycle: 'Sun',
        colorTag: expect.any(String),
      },
    ]);
  });

  it('surfaces reports across ALL of a user\u2019s goals, not just their newest one', async () => {
    // A user who turned their goal off/on again, or changed their target,
    // gets a new Goal document each time — history from the earlier one(s)
    // must not disappear just because a newer goal now exists.
    goalFind.mockReturnValue({
      lean: () => ({
        exec: () =>
          Promise.resolve([
            { _id: 'old', appUserId: 'u1', frequency: 'DAILY', targetedAverageNeckAngle: 70 },
            { _id: 'new', appUserId: 'u1', frequency: 'WEEKLY', targetedAverageNeckAngle: 85 },
          ]),
      }),
    });
    reportFind.mockReturnValue({
      sort: () => ({
        lean: () => ({
          exec: () =>
            Promise.resolve([
              {
                goalId: 'new',
                actualAverageNeckAngle: 80,
                complianceInPercentage: 94,
                dateOfConcludedCycle: new Date('2026-08-16T00:00:00.000Z'),
              },
              {
                goalId: 'old',
                actualAverageNeckAngle: 60,
                complianceInPercentage: 85,
                dateOfConcludedCycle: new Date('2026-07-01T00:00:00.000Z'),
              },
            ]),
        }),
      }),
    });

    const result = await GoalService.getAllGoalsByIdAsync('u1');

    expect(reportFind).toHaveBeenCalledWith({ goalId: { $in: ['old', 'new'] } });
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ frequency: 'WEEKLY', targetedAverageNeckAngle: 85 });
    expect(result[1]).toMatchObject({ frequency: 'DAILY', targetedAverageNeckAngle: 70 });
  });

  it('uses a stable report order and excludes reports without matching user-owned goal metadata', async () => {
    const goal = { _id: 'goal-1', appUserId: 'u1', frequency: 'DAILY', targetedAverageNeckAngle: 75 };
    const reportDate = new Date('2026-08-16T00:00:00.000Z');
    const reportSort = vi.fn().mockReturnValue({
      lean: () => ({
        exec: () => Promise.resolve([
          {
            goalId: 'goal-1',
            actualAverageNeckAngle: 60,
            complianceInPercentage: 80,
            dateOfConcludedCycle: reportDate,
          },
          {
            goalId: 'not-this-users-goal',
            actualAverageNeckAngle: 90,
            complianceInPercentage: 100,
            dateOfConcludedCycle: reportDate,
          },
          {
            actualAverageNeckAngle: 90,
            complianceInPercentage: 100,
            dateOfConcludedCycle: reportDate,
          },
        ]),
      }),
    });
    goalFind.mockReturnValue({ lean: () => ({ exec: () => Promise.resolve([goal]) }) });
    reportFind.mockReturnValue({ sort: reportSort });

    const result = await GoalService.getAllGoalsByIdAsync('u1');

    expect(reportSort).toHaveBeenCalledWith({ dateOfConcludedCycle: -1, _id: -1 });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      appUserId: 'u1',
      frequency: 'DAILY',
      targetedAverageNeckAngle: 75,
    });
  });
});

describe('GoalService goal writes and current target', () => {
  it('creates the Goal with one dateSet and never stores client completion reports', async () => {
    const now = new Date('2026-10-01T10:00:00.000Z');
    const user = { isGoalOn: false, save: vi.fn().mockResolvedValue(undefined) };
    mocks.appUserFindById.mockResolvedValue(user);
    vi.useFakeTimers();
    vi.setSystemTime(now);

    try {
      await GoalService.turnOnGoalAsync('u1', {
        targetedAverageNeckAngle: 60,
        frequency: 'DAILY',
        goalCycleCompletionReports: [{ complianceInPercentage: 100 }],
      } as any);
    } finally {
      vi.useRealTimers();
    }

    expect(mocks.constructGoal).toHaveBeenCalledWith({
      appUserId: 'u1',
      targetedAverageNeckAngle: 60,
      frequency: 'DAILY',
      dateSet: now,
      nextCycleEndsAt: new Date('2026-10-01T23:59:59.999Z'),
    });
    expect(reportFind).not.toHaveBeenCalled();
    expect(user.isGoalOn).toBe(true);
    expect(user.save).toHaveBeenCalledOnce();
  });

  it('retires the latest goal cycle schedule when the user turns the goal off', async () => {
    const user = { isGoalOn: true, save: vi.fn().mockResolvedValue(undefined) };
    mocks.appUserFindById.mockResolvedValue(user);
    mocks.getLatestGoal.mockResolvedValue({ _id: 'active-goal' });

    await GoalService.turnOffGoalAsync('u1', { targetedAverageNeckAngle: 60 });

    expect(user.isGoalOn).toBe(false);
    expect(user.save).toHaveBeenCalledOnce();
    expect(mocks.getLatestGoal).toHaveBeenCalledWith('u1');
    expect(mocks.updateGoal).toHaveBeenCalledWith(
      { _id: 'active-goal' },
      { $set: { nextCycleEndsAt: null } }
    );
  });

  it('uses the shared deterministic latest-goal lookup for the current target', async () => {
    mocks.getLatestGoal.mockResolvedValue({ targetedAverageNeckAngle: 68 });

    await expect(GoalService.getCurrentTargetedAverageNeckAngleAsync('u1')).resolves.toBe(68);
    expect(mocks.getLatestGoal).toHaveBeenCalledWith('u1');
  });
});
