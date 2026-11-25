import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getAllGoalsByIdAsync, turnOnGoalAsync } = vi.hoisted(() => ({
  getAllGoalsByIdAsync: vi.fn(),
  turnOnGoalAsync: vi.fn(),
}));

vi.mock('../../src/services/goal.service', () => ({
  GoalService: {
    getAllGoalsByIdAsync,
    turnOnGoalAsync,
  },
}));

import { GoalController } from '../../src/controllers/goal.controller';
import { swaggerSpec } from '../../src/config/swagger';

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
  getAllGoalsByIdAsync.mockReset();
  turnOnGoalAsync.mockReset();
});

describe('GoalController.turnOnGoalByUserId', () => {
  it('documents the same request schema used by controller validation', () => {
    const operation = (swaggerSpec as any).paths['/goals/turn-on'].post;
    const requestSchema = (swaggerSpec as any).components.schemas.GoalTurnOnRequest;

    expect(operation.requestBody.content['application/json'].schema).toEqual({
      $ref: '#/components/schemas/GoalTurnOnRequest',
    });
    expect(requestSchema.required).toEqual(
      expect.arrayContaining(['targetedAverageNeckAngle', 'frequency'])
    );
    expect(requestSchema.properties.targetedAverageNeckAngle.maximum).toBe(90);
    expect(requestSchema.properties.frequency.enum).toEqual(['DAILY', 'WEEKLY']);
  });

  it.each([
    { targetedAverageNeckAngle: 60, frequency: 'Daily' },
    { targetedAverageNeckAngle: 60, frequency: 'MONTHLY' },
    { targetedAverageNeckAngle: 0, frequency: 'DAILY' },
    { targetedAverageNeckAngle: -1, frequency: 'WEEKLY' },
    { targetedAverageNeckAngle: 91, frequency: 'WEEKLY' },
    { targetedAverageNeckAngle: Number.NaN, frequency: 'DAILY' },
    { targetedAverageNeckAngle: Number.POSITIVE_INFINITY, frequency: 'DAILY' },
    { targetedAverageNeckAngle: '60', frequency: 'DAILY' },
  ])('rejects invalid goal data: %o', async (body) => {
    const res = makeRes();

    await GoalController.turnOnGoalByUserId(
      { user: { userId: 'user-1' }, body } as any,
      res
    );

    expect(res.statusCode).toBe(400);
    expect(turnOnGoalAsync).not.toHaveBeenCalled();
  });

  it('accepts the upper target boundary', async () => {
    turnOnGoalAsync.mockResolvedValue(true);
    const res = makeRes();

    await GoalController.turnOnGoalByUserId(
      {
        user: { userId: 'user-1' },
        body: { targetedAverageNeckAngle: 90, frequency: 'WEEKLY' },
      } as any,
      res
    );

    expect(res.statusCode).toBe(201);
    expect(turnOnGoalAsync).toHaveBeenCalledWith('user-1', {
      targetedAverageNeckAngle: 90,
      frequency: 'WEEKLY',
    });
  });

  it('discards client-authored completion reports while preserving compatibility with older clients', async () => {
    turnOnGoalAsync.mockResolvedValue(true);
    const res = makeRes();

    await GoalController.turnOnGoalByUserId(
      {
        user: { userId: 'user-1' },
        body: {
          targetedAverageNeckAngle: 60,
          frequency: 'DAILY',
          goalCycleCompletionReports: [{ complianceInPercentage: 100 }],
        },
      } as any,
      res
    );

    expect(res.statusCode).toBe(201);
    expect(turnOnGoalAsync).toHaveBeenCalledWith('user-1', {
      targetedAverageNeckAngle: 60,
      frequency: 'DAILY',
    });
  });
});

describe('GoalController.getGoalsByUserId', () => {
  it('returns 200 with an empty array when no completed goal history exists', async () => {
    getAllGoalsByIdAsync.mockResolvedValue([]);

    const req = {
      user: {
        userId: 'test-user-123',
      },
    };

    const res = makeRes();

    await GoalController.getGoalsByUserId(req as any, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: [],
    });

    expect(getAllGoalsByIdAsync).toHaveBeenCalledWith('test-user-123');
  });

  it('returns 401 when the authenticated user ID is missing', async () => {
    const req = {
      user: undefined,
    };

    const res = makeRes();

    await GoalController.getGoalsByUserId(req as any, res);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({
      error: 'Unauthorized: User ID is missing.',
    });

    expect(getAllGoalsByIdAsync).not.toHaveBeenCalled();
  });
});
