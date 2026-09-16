import AppUser from '../models/AppUser';
import { Goal } from '../models/Goal';
import { SetGoalViewModel, TurnOnGoalViewModel } from '../types/goal.types';
import { GoalCycleReportViewModel } from '../types/goalCycleReport.types';
import { CustomException } from '../utils/customException';
import { DateLibrary } from '../utils/dateLibrary';
import { Utils } from '../utils/utils';
import { PushNotificationDriver } from './pushNotificationDriver';
import { CronJob } from 'cron';
import { logger } from '../utils/logger';
import { AppUserService } from './appUserServices/appUserService.service';
import { PushNotificationModelDTO } from '../types/pushNotificationModel.types';
import { GoalCycleCompletionReport } from '../models/GoalCycleCompletionReport';
import { computeFirstCycleEndsAt, isSupportedFrequency } from './goalCycle';

export class GoalService {
  static async turnOnGoalAsync(appUserId: string, model: SetGoalViewModel): Promise<boolean> {
    try {
      const user = await AppUser.findById(appUserId);

      if (!user) {
        logger.warn('turn-on goal failed: user does not exist', { userId: appUserId });
        throw new CustomException('User does not exist');
      }

      const reports = model.goalCycleCompletionReports ?? [];
      if (reports.length === 0) {
        logger.info('turn-on goal with no goal cycle reports', { userId: appUserId });
      }

      const incomingReports = model.goalCycleCompletionReports ?? [];

      // Save each GoalCycleCompletionReport individually
      const savedReports = await Promise.all(
        reports.map(async (report) => {
          const reportDoc = new GoalCycleCompletionReport({
            actualAverageNeckAngle: report.actualAverageNeckAngle,
            complianceInPercentage: report.complianceInPercentage,
            dateOfConcludedCycle: report.dateOfConcludedCycle,
          });
          const saved = await reportDoc.save();
          logger.debug('Saved goal cycle completion report', {
            userId: appUserId,
            reportId: saved._id?.toString(),
          });
          return saved;
        })
      );

      const goal = new Goal({
        appUserId,
        targetedAverageNeckAngle: model.targetedAverageNeckAngle,
        frequency: model.frequency,
        dateSet: DateLibrary.getCurrentDateTime(),
        goalCycleCompletionReports: reports,
        nextCycleEndsAt: isSupportedFrequency(model.frequency)
          ? computeFirstCycleEndsAt(DateLibrary.getCurrentDateTime(), model.frequency)
          : undefined,
      });
      const savedGoal = await goal.save();
      logger.info('Goal created', {
        userId: appUserId,
        goalId: savedGoal._id?.toString(),
        targetedAverageNeckAngle: model.targetedAverageNeckAngle,
        frequency: model.frequency,
        reportCount: savedReports.length,
      });

      user.isGoalOn = true;
      await user.save();
      logger.info('Goal flag enabled for user', { userId: appUserId });

      // this.scheduleJob(model.appUserId, 'DAILY', savedGoal.dateSet, savedGoal._id?.toString() || '');

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

  static async turnOffGoalAsync(appUserId: string, model: TurnOnGoalViewModel): Promise<boolean> {
    try {
      const user = await AppUser.findById(appUserId);
      if (!user) throw new CustomException('User not found');

      user.isGoalOn = false;
      await user.save();

      // this.removeScheduledJob(userId);

      return true;
    } catch (error: any) {
      logger.error(error.message);
      throw new CustomException(error.message);
    }
  }

  static async getAllGoalsByIdAsync(
    appUserId: string,
  ): Promise<GoalCycleReportViewModel[]> {
    try {
      // Reads from the GoalCycleCompletionReport collection directly, keyed
      // by goalId — NOT `goal.goalCycleCompletionReports` (the embedded
      // array on the Goal document). Those are two different places and
      // only one of them is actually kept up to date:
      // runGoalCycleSummary() (src/services/goalCycleSummary.service.ts),
      // the real ongoing job that concludes a cycle and records its
      // compliance every day/week, saves each report as its own
      // GoalCycleCompletionReport document (see its `goalId: goal._id`) —
      // it never touches the embedded array. That array is only ever
      // seeded once, at turnOnGoalAsync time, from whatever the client
      // happened to submit when the goal was first turned on. Reading it
      // here meant every real cycle the job concluded was invisible to
      // this endpoint, forever — this is what "goal history" showing
      // nothing (or a permanently frozen snapshot) actually was.
      //
      // This is also the same collection `computeNeckAngleParameters()`
      // (src/services/appUserServices/neckAngle.service.ts) already reads
      // for the "current goal compliance" figure shown on Home/Stats/Goal —
      // that one was correct; this is what brings history in line with it.
      //
      // Querying by ALL of the user's Goal IDs (not just their newest goal)
      // also fixes a second, related gap: a user who ever turned their
      // goal off/on again, or changed their target angle, got a new Goal
      // document each time — under the old `Goal.findOne(...)` (newest
      // only) lookup, every concluded cycle recorded against an earlier
      // Goal document became permanently unreachable from this endpoint
      // the moment a newer one existed, even though the data was still
      // sitting right there in the database.
      const goals = await Goal.find({ appUserId }).lean().exec();
      if (!goals || goals.length === 0) return [];

      const goalById = new Map(goals.map((g: any) => [g._id.toString(), g]));
      const goalIds = goals.map((g: any) => g._id);

      const cycleReports = await GoalCycleCompletionReport.find({ goalId: { $in: goalIds } })
        .sort({ dateOfConcludedCycle: -1 })
        .lean()
        .exec();

      const reports: GoalCycleReportViewModel[] = cycleReports.map((report: any, index: number) => {
        const goal = goalById.get(report.goalId?.toString() ?? '');
        return {
          id: index + 1,
          appUserId,
          frequency: goal?.frequency ?? '',
          targetedAverageNeckAngle: goal?.targetedAverageNeckAngle ?? 0,
          actualAverageNeckAngle: Math.round((report.actualAverageNeckAngle ?? 0) * 10) / 10,
          complianceInPercentage: Math.round((report.complianceInPercentage ?? 0) * 10) / 10,
          dateOfConcludedCycle: report.dateOfConcludedCycle,
          dayOfConcludedCycle: DateLibrary.formatDay(report.dateOfConcludedCycle?.toString() ?? ''),
          colorTag: Utils.getColorTag(report.complianceInPercentage ?? 0),
        };
      });

      return reports;
    } catch (error: any) {
      logger.error(error.message);
      throw new CustomException(error.message);
    }
  }

  static async getCurrentTargetedAverageNeckAngleAsync(appUserId: string): Promise<number> {
    try {
      const goals = await Goal.find({ appUserId }).sort({ dateSet: -1 }).exec();
      const lastGoal = goals[0]; // Most recent goal due to sorting
      console.log('Last Goal:', lastGoal);
      return lastGoal?.targetedAverageNeckAngle ?? 0;
    } catch (error: any) {
      logger.error(error.message);
      throw new CustomException(error.message);
    }
  }

  async testJobScheduler(): Promise<boolean> {
    try {
      const model: PushNotificationModelDTO = {
        to: 'et9fhiwOUvI:APA91bEyUxI25XaktkMxe1tt-i9Ff3z4-SL8jIDky2f1ClgqAT62RjhxLoZxq6191Kqf_byKhHTJxXhdRM56640ISc-2clzhT3lZXDuhrY_lX573gw00ADQB8aZnOM7x7yHGxgttajgP',
        title: 'Test Scheduler',
        body: 'Toyosi the laziest dev',
      };

      new CronJob(
        '* * * * *', // runs every minute
        async () => {
          await PushNotificationDriver.sendPushNotification(model);
        },
        null, // onComplete
        true // start immediately
      );
      return true;
    } catch (error: any) {
      logger.error(error.message);
      throw new CustomException(error.message);
    }
  }

  private formatDay(dayIndex: number): string {
    const days = ['SUN', 'MON', 'TUE', 'WED', 'THUR', 'FRI', 'SAT'];
    return days[dayIndex] ?? 'NIL';
  }

  private scheduleJob(userId: string, frequency: string, dateSet: Date, goalId: string): void {
    const jobId = `userid-${userId}`;
    const cronTime = frequency === 'DAILY' ? '*/5 * * * *' : '*/10 * * * *';

    new CronJob(
      cronTime,
      () => {
        AppUserService.calculateAverageOfLastWeekOrDay(userId, frequency, dateSet, goalId);
      },
      null,
      true,
      undefined,
      undefined,
      false
    );
  }

  private removeScheduledJob(userId: string): void {
    const jobId = `userid-${userId}`;
    // Implement job removal logic depending on your scheduler
  }
}