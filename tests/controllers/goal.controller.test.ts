import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getAllGoalsByIdAsync } = vi.hoisted(() => ({
  getAllGoalsByIdAsync: vi.fn(),
}));

vi.mock('../../src/services/goal.service', () => ({
  GoalService: {
    getAllGoalsByIdAsync,
  },
}));

import { GoalController } from '../../src/controllers/goal.controller';

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
