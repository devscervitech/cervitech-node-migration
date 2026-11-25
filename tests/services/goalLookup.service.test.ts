import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  aggregate: vi.fn(),
  findOne: vi.fn(),
}));

vi.mock('../../src/models/Goal', () => ({
  Goal: {
    aggregate: (...args: unknown[]) => mocks.aggregate(...args),
    findOne: (...args: unknown[]) => mocks.findOne(...args),
  },
}));

import { getLatestGoal, getLatestGoalsByUserIds } from '../../src/services/goalLookup.service';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('shared latest-goal lookup', () => {
  it('selects one latest goal per user using dateSet and _id as stable ordering keys', async () => {
    const latestGoals = [
      { _id: 'g2', appUserId: 'u1', targetedAverageNeckAngle: 60 },
      { _id: 'g3', appUserId: 'u2', targetedAverageNeckAngle: 70 },
    ];
    mocks.aggregate.mockReturnValue({ exec: vi.fn().mockResolvedValue(latestGoals) });

    const result = await getLatestGoalsByUserIds(['u1', 'u1', 'u2']);

    expect(mocks.aggregate).toHaveBeenCalledWith([
      { $match: { appUserId: { $in: ['u1', 'u2'] } } },
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
    expect(result.get('u1')).toMatchObject({ _id: 'g2', targetedAverageNeckAngle: 60 });
    expect(result.get('u2')).toMatchObject({ _id: 'g3', targetedAverageNeckAngle: 70 });
  });

  it('uses the same deterministic ordering for a single-user lookup', async () => {
    const latestGoal = { _id: 'g2', appUserId: 'u1', targetedAverageNeckAngle: 60 };
    const exec = vi.fn().mockResolvedValue(latestGoal);
    const select = vi.fn().mockReturnValue({ exec });
    const sort = vi.fn().mockReturnValue({ select });
    mocks.findOne.mockReturnValue({ sort });

    await expect(getLatestGoal('u1')).resolves.toBe(latestGoal);

    expect(mocks.findOne).toHaveBeenCalledWith({ appUserId: 'u1' });
    expect(sort).toHaveBeenCalledWith({ dateSet: -1, _id: -1 });
    expect(select).toHaveBeenCalledWith(
      '_id appUserId dateSet targetedAverageNeckAngle frequency nextCycleEndsAt'
    );
  });

  it('does not query MongoDB for an empty batch', async () => {
    await expect(getLatestGoalsByUserIds([])).resolves.toEqual(new Map());
    expect(mocks.aggregate).not.toHaveBeenCalled();
  });
});
