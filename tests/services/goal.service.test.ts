import { describe, it, expect, vi, beforeEach } from 'vitest';

const goalFind = vi.fn();
const reportFind = vi.fn();

vi.mock('../../src/models/Goal', () => ({
  Goal: {
    find: (...args: unknown[]) => goalFind(...args),
  },
}));

vi.mock('../../src/models/AppUser', () => ({
  default: { findById: vi.fn() },
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

import { GoalService } from '../../src/services/goal.service';

beforeEach(() => {
  vi.clearAllMocks();
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
});
