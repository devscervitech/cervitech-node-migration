import { Goal, IGoal } from '../models/Goal';
import { Types } from 'mongoose';

const LATEST_GOAL_SORT = { dateSet: -1, _id: -1 } as const;

export interface LatestGoal {
  _id: Types.ObjectId;
  appUserId: string;
  dateSet: Date;
  targetedAverageNeckAngle: number;
  frequency: string;
  nextCycleEndsAt?: Date | null;
}

/**
 * Returns the newest goal for each user. The secondary _id sort makes the
 * result deterministic when two goals have the same dateSet timestamp.
 */
export async function getLatestGoalsByUserIds(
  appUserIds: string[]
): Promise<Map<string, LatestGoal>> {
  const uniqueUserIds = [...new Set(appUserIds)];
  if (uniqueUserIds.length === 0) return new Map();

  const goals = await Goal.aggregate<LatestGoal>([
    { $match: { appUserId: { $in: uniqueUserIds } } },
    { $sort: LATEST_GOAL_SORT },
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
  ]).exec();

  return new Map<string, LatestGoal>(
    goals.map((goal) => [goal.appUserId, goal] as const)
  );
}

export async function getLatestGoal(appUserId: string): Promise<IGoal | null> {
  const goal = await Goal.findOne({ appUserId })
    .sort(LATEST_GOAL_SORT)
    .select('_id appUserId dateSet targetedAverageNeckAngle frequency nextCycleEndsAt')
    .exec();
  return goal as IGoal | null;
}
