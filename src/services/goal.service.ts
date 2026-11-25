import AppUser from '../models/AppUser';
import { Goal } from '../models/Goal';
import { SetGoalViewModel, TurnOnGoalViewModel } from '../types/goal.types';
import { GoalCycleReportViewModel } from '../types/goalCycleReport.types';
import { CustomException } from '../utils/customException';
import { DateLibrary } from '../utils/dateLibrary';
import { Utils } from '../utils/utils';
import { logger } from '../utils/logger';
import { GoalCycleCompletionReport } from '../models/GoalCycleCompletionReport';
import { computeFirstCycleEndsAt, isSupportedFrequency } from './goalCycle';
import { getLatestGoal } from './goalLookup.service';

export class GoalService {
  static async turnOnGoalAsync(appUserId: string, model: SetGoalViewModel): Promise<boolean> {
    try {
      const user = await AppUser.findById(appUserId);

      if (!user) {
        logger.warn('turn-on goal failed: user does not exist', { userId: appUserId });
        throw new CustomException('User does not exist');
      }

      const dateSet = new Date();
      const goal = new Goal({
        appUserId,
        targetedAverageNeckAngle: model.targetedAverageNeckAngle,
        frequency: model.frequency,
        dateSet,
        nextCycleEndsAt: isSupportedFrequency(model.frequency)
          ? computeFirstCycleEndsAt(dateSet, model.frequency)
          : undefined,
      });
      const savedGoal = await goal.save();
      logger.info('Goal created', {
        userId: appUserId,
        goalId: savedGoal._id?.toString(),
        targetedAverageNeckAngle: model.targetedAverageNeckAngle,
        frequency: model.frequency,
      });

      user.isGoalOn = true;
      await user.save();
      logger.info('Goal flag enabled for user', { userId: appUserId });

      return true;
    } catch (error: any) {
      logger.error('turnOnGoalAsync failed', {
        userId: appUserId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw new CustomException(error.message);
    }
  }

  static async turnOffGoalAsync(appUserId: string, _model: TurnOnGoalViewModel): Promise<boolean> {
    try {
      const user = await AppUser.findById(appUserId);
      if (!user) throw new CustomException('User not found');

      user.isGoalOn = false;
      await user.save();

      const latestGoal = await getLatestGoal(appUserId);
      if (latestGoal) {
        await Goal.updateOne(
          { _id: latestGoal._id },
          { $set: { nextCycleEndsAt: null } }
        );
      }

      return true;
    } catch (error: any) {
      logger.error(error);
      throw new CustomException(error.message);
    }
  }

  static async getAllGoalsByIdAsync(appUserId: string): Promise<GoalCycleReportViewModel[]> {
    try {
      const goals = await Goal.find({ appUserId }).lean().exec();
      if (goals.length === 0) return [];

      const goalById = new Map<string, (typeof goals)[number]>(
        goals.map((goal) => [String(goal._id), goal] as const)
      );
      const reports = await GoalCycleCompletionReport.find({
        goalId: { $in: goals.map((goal) => goal._id) },
      })
        .sort({ dateOfConcludedCycle: -1, _id: -1 })
        .lean()
        .exec();

      let id = 1;
      return reports.flatMap((report) => {
        const goal = report.goalId ? goalById.get(String(report.goalId)) : undefined;
        if (!goal) return [];

        return [{
          id: id++,
          appUserId: goal.appUserId,
          frequency: goal.frequency,
          targetedAverageNeckAngle: goal.targetedAverageNeckAngle,
          actualAverageNeckAngle: Math.round(report.actualAverageNeckAngle * 10) / 10,
          complianceInPercentage: Math.round(report.complianceInPercentage * 10) / 10,
          dateOfConcludedCycle: report.dateOfConcludedCycle,
          dayOfConcludedCycle: DateLibrary.formatDay(report.dateOfConcludedCycle.toString()),
          colorTag: Utils.getColorTag(report.complianceInPercentage),
        }];
      });
    } catch (error: any) {
      logger.error(error);
      throw new CustomException(error.message);
    }
  }

  static async getCurrentTargetedAverageNeckAngleAsync(appUserId: string): Promise<number> {
    try {
      const latestGoal = await getLatestGoal(appUserId);
      return latestGoal?.targetedAverageNeckAngle ?? 0;
    } catch (error: any) {
      logger.error(error);
      throw new CustomException(error.message);
    }
  }
}
