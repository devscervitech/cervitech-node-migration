import AppUser from '../models/AppUser';
import { Goal } from '../models/Goal';
import { SetGoalViewModel, TurnOnGoalViewModel } from '../dtos/goal.DTO';
import { GoalCycleReportViewModel } from '../dtos/GoalCycleReport.DTO';
import { CustomException } from '../helpers/CustomException';
import { DateLibrary } from '../helpers/dateLibrary';
import { Utils } from '../helpers/utils';
import { PushNotificationDriver } from './pushNotificationDriver';
import { CronJob } from 'cron';
import { logger } from '../utils/logger';
import { AppUserService } from './appUserService.service';
import { PushNotificationModelDTO } from '../dtos/PushNotificationModelDTO';
import { GoalCycleCompletionReport } from '../models/GoalCycleCompletionReport';

export class GoalService {
  static async turnOnGoalAsync(model: SetGoalViewModel): Promise<boolean> {
    try {
      const user = await AppUser.findById(model.appUserId);
      console.log('appUserId:', model.appUserId, typeof model.appUserId);

      if (!user) throw new CustomException('User does not exist');

      // Save each GoalCycleCompletionReport individually
      const savedReports = await Promise.all(
        model.goalCycleCompletionReports.map(async (report) => {
          const reportDoc = new GoalCycleCompletionReport({
            actualAverageNeckAngle: report.actualAverageNeckAngle,
            complianceInPercentage: report.complianceInPercentage,
            dateOfConcludedCycle: report.dateOfConcludedCycle,
          });
          return await reportDoc.save();
        })
      );

      const goal = new Goal({
        targetedAverageNeckAngle: model.targetedAverageNeckAngle,
        frequency: model.frequency,
        dateSet: DateLibrary.getCurrentDateTime(),
        goalCycleCompletionReports: model.goalCycleCompletionReports,
      });

      // Preserve appUserId even though it is not declared in GoalSchema.
      goal.set('appUserId', model.appUserId, { strict: false });

      await goal.save();

      user.isGoalOn = true;
      await user.save();

      // this.scheduleJob(model.appUserId, 'DAILY', savedGoal.dateSet, savedGoal._id?.toString() || '');

      return true;
    } catch (error: any) {
      logger.error(error.message);
      throw new CustomException(error.message);
    }
  }

  static async turnOffGoalAsync(model: TurnOnGoalViewModel): Promise<boolean> {
    try {
      const user = await AppUser.findById(model.appUserId);
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
    model: TurnOnGoalViewModel
  ): Promise<GoalCycleReportViewModel[]> {
    try {
      const goals = await Goal.find({
        appUserId: model.appUserId,
      }).exec();

      if (!goals.length) {
        return [];
      }

      const reports: GoalCycleReportViewModel[] = [];

      let counter = 1;
      for (const goal of goals) {
        for (const report of goal.goalCycleCompletionReports) {
          reports.push({
            id: counter++, // numeric,
            appUserId: goal.appUserId,
            frequency: goal.frequency,
            targetedAverageNeckAngle: goal.targetedAverageNeckAngle,
            actualAverageNeckAngle: Math.round(report.actualAverageNeckAngle * 10) / 10,
            complianceInPercentage: Math.round(report.complianceInPercentage * 10) / 10,
            dateOfConcludedCycle: report.dateOfConcludedCycle,
            dayOfConcludedCycle: report.dayOfConcludedCycle,
            colorTag: Utils.getColorTag(report.complianceInPercentage),
          });
        }
      }

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
