import { Types } from 'mongoose';
import { NeckAngleModel } from '../../models/NeckAngle';
import { NeckAngleRecordModel } from '../../models/NeckAngleRecord';
import { SendAverageNeckAnglePushNotificationViewModel } from '../../viewmodels/PushNotificationViewModel';
import { getCraniumVertebralAngleFromNeckAngle } from '../../utils/computations';
import AppUser from '../../models/AppUser';
import { CustomException } from '../../utils/customException';
import { logger } from '../../utils/logger';
import { DateLibrary } from '../../utils/dateLibrary';
import { AbbreviatedNeckAngleRecordViewModel } from '../../viewmodels/AbbreviatedNeckAngleRecord.viewmodel';
import { WeeklyAngleDataViewModel } from '../../viewmodels/WeeklyAngleDataViewModel';
import { INeckAngleRecord } from '../../models/NeckAngleRecord';
import ResponseRate from '../../models/ResponseRate';
import { PushNotificationDriver } from '../pushNotificationDriver';
import { Utils } from '../../utils/utils';
import { AutomatePostNeckAngleRecordsViewModel } from '../../viewmodels/AutomatePostNeckAngleRecords';
import { Goal } from '../../models/Goal';
import { GoalCycleCompletionReport } from '../../models/GoalCycleCompletionReport';
import { GOAL_FREQUENCY } from '../../enums/goalFrequency';

import { NeckAngleParametersViewModel } from '../../viewmodels/NeckAngleParameters.viewmodel';

import { DailyAngleDataViewModel } from '../../viewmodels/DailyAngleData.viewmodel';
import { GoalCycleReportViewModel } from '../../viewmodels/GoalCycleReport.viewmodel';
import { WeeklyChartDataViewModel } from '../../viewmodels/WeeklyChartData.viewmodel';

export class NeckAngleService {
  static async postBatchNeckAngleRecordAsync(neckAngleModel: NeckAngleModel): Promise<boolean> {
    try {
      for (const record of neckAngleModel.neckAngleRecords) {
        const appUser = await AppUser.findById(record.appUserId);
        if (!appUser) {
          logger.warn(`AppUser ${record.appUserId} not found, skipping.`);
          continue;
        }

        const lastRecord = await NeckAngleRecordModel.findOne({ appUserId: record.appUserId }).sort({
          counter: -1,
        });

        const counter = (lastRecord?.counter ?? 0) + 1;
        const craniumVertebralAngle = getCraniumVertebralAngleFromNeckAngle(record.angle);

        const neckAngleRecord = new NeckAngleRecordModel({
          appUserId: record.appUserId,
          craniumVertebralAngle,
          counter,
          dateTimeRecorded: new Date(record.dateTimeRecorded),
          angle: record.angle,
        });

        await neckAngleRecord.save();

        await AppUser.updateOne(
          { _id: record.appUserId },
          { $push: { neckAngleRecords: neckAngleRecord } }
        );

        const prompt = appUser.prompt ?? NeckAngleService.defaultPrompt;
        if (prompt > 0 && counter % prompt === 0) {
          const averageNeckAngle = await this.calculateAverageOfLastSetNeckAngles(record.appUserId);
          const notificationPayload: SendAverageNeckAnglePushNotificationViewModel = {
            userId: record.appUserId,
            averageNeckAngle,
          };
          await this.sendPushNotificationMessageForAverageNeckAngle(notificationPayload);
        }
      }

      return true;
    } catch (error: any) {
      logger.error(error.message || 'Unhandled exception');
      throw error;
    }
  }

  static readonly numberOfRecordPostBeforeSendingAverageNeckAngle: number = (() => {
    const raw = parseInt(process.env.ENV_NUMBER_OF_RECORD_POST_BEFORE_SENDING_AVERAGE_NECK_ANGLE ?? '', 10);
    return Number.isFinite(raw) && raw > 0 ? raw : 5;
  })();

  static async getEachWeekOfTheMonthAverageNeckAngle(
    aMonthAngleRecords: AbbreviatedNeckAngleRecordViewModel[]
  ): Promise<WeeklyAngleDataViewModel[]> {
    try {
      let weekOneRecords = 0,
        weekTwoRecords = 0,
        weekThreeRecords = 0,
        weekFourRecords = 0,
        weekFiveRecords = 0;

      let weekOneCount = 0,
        weekTwoCount = 0,
        weekThreeCount = 0,
        weekFourCount = 0,
        weekFiveCount = 0;

      for (const record of aMonthAngleRecords) {
        const weekNum = DateLibrary.getWeekNumberOfMonth(record.dateTimeRecorded);

        switch (weekNum) {
          case 1:
            weekOneRecords += record.angle;
            weekOneCount++;
            break;
          case 2:
            weekTwoRecords += record.angle;
            weekTwoCount++;
            break;
          case 3:
            weekThreeRecords += record.angle;
            weekThreeCount++;
            break;
          case 4:
            weekFourRecords += record.angle;
            weekFourCount++;
            break;
          case 5:
            weekFiveRecords += record.angle;
            weekFiveCount++;
            break;
          default:
            break;
        }
      }

      const averageNeckAngleForEachWeekOfTheMonthWeek: WeeklyAngleDataViewModel[] = [
        {
          week: 1,
          averageNeckAngle: weekOneCount < 1 ? 0 : weekOneRecords / weekOneCount,
        },
        {
          week: 2,
          averageNeckAngle: weekTwoCount < 1 ? 0 : weekTwoRecords / weekTwoCount,
        },
        {
          week: 3,
          averageNeckAngle: weekThreeCount < 1 ? 0 : weekThreeRecords / weekThreeCount,
        },
        {
          week: 4,
          averageNeckAngle: weekFourCount < 1 ? 0 : weekFourRecords / weekFourCount,
        },
        {
          week: 5,
          averageNeckAngle: weekFiveCount < 1 ? 0 : weekFiveRecords / weekFiveCount,
        },
      ];

      return averageNeckAngleForEachWeekOfTheMonthWeek;
    } catch (error: any) {
      logger.error('Error in getEachWeekOfTheMonthAverageNeckAngle:', error.message);
      throw new CustomException('Error calculating weekly averages.');
    }
  }

  static getEachMonthOfTheYearAverageNeckAngle(
    aYearAngleRecords: AbbreviatedNeckAngleRecordViewModel[]
  ): { month: string; averageNeckAngle: number }[] {
    try {
      const monthsMap = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
      ];

      const totals: { [key: number]: number } = {};
      const counts: { [key: number]: number } = {};

      for (const record of aYearAngleRecords) {
        const monthNum = record.dateTimeRecorded.getMonth(); // 0-11
        totals[monthNum] = (totals[monthNum] || 0) + record.angle;
        counts[monthNum] = (counts[monthNum] || 0) + 1;
      }

      const averages: { month: string; averageNeckAngle: number }[] = [];

      for (let i = 0; i < 12; i++) {
        averages.push({
          month: monthsMap[i],
          averageNeckAngle: counts[i] && counts[i] > 0 ? totals[i] / counts[i] : 0,
        });
      }

      return averages;
    } catch (error: any) {
      logger.error('Error in getEachMonthOfTheYearAverageNeckAngle:', error.message);
      throw new CustomException('Error calculating yearly averages.');
    }
  }

  static getEachDayOfTheWeekAverageNeckAngle(
    aWeekAngleRecords: AbbreviatedNeckAngleRecordViewModel[]
  ): DailyAngleDataViewModel[] {
    try {
      // Sunday = 0, Monday = 1, etc.
      const daysMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

      // keep totals and counts
      const totals: { [key: number]: number } = {};
      const counts: { [key: number]: number } = {};

      for (const record of aWeekAngleRecords) {
        const dayNum = record.dateTimeRecorded.getDay(); // 0-6
        totals[dayNum] = (totals[dayNum] || 0) + record.angle;
        counts[dayNum] = (counts[dayNum] || 0) + 1;
      }

      const averages: DailyAngleDataViewModel[] = [];

      for (let i = 0; i < 7; i++) {
        averages.push({
          day: daysMap[i],
          averageNeckAngle: counts[i] && counts[i] > 0 ? totals[i] / counts[i] : 0,
        });
      }

      return averages;
    } catch (error: any) {
      logger.error('Error in getEachDayOfTheWeekAverageNeckAngle:', error.message);
      throw new CustomException('Error calculating daily averages.');
    }
  }

  static async calculateAverageOfLastSetNeckAngles(userId: string): Promise<number> {
    const records = await NeckAngleRecordModel.find({ appUserId: userId })
      .sort({ _id: -1 })
      .limit(NeckAngleService.numberOfRecordPostBeforeSendingAverageNeckAngle);

    if (!records || records.length === 0) {
      throw new Error('No records found for this user');
    }

    const sumOfAngles = records.reduce((sum, record) => sum + record.angle, 0);
    let averageAngle =
      Math.round(
        (sumOfAngles / NeckAngleService.numberOfRecordPostBeforeSendingAverageNeckAngle) * 10
      ) / 10;

    if (isNaN(averageAngle)) averageAngle = 0;

    const user = await AppUser.findById(userId);
    if (user) {
      user.responseRate = 100 - (100 * (90 - averageAngle)) / 90;
      await user.save();
    }

    return averageAngle;
  }

  static async sendPushNotificationMessageForAverageNeckAngle(
    notificationPayload: SendAverageNeckAnglePushNotificationViewModel
  ): Promise<boolean> {
    // Was `AppUser.find()` — every batch post from any single user was
    // pushing a notification to every user in the database. This only
    // concerns the one user whose batch just crossed their prompt count.
    const appUsers = await AppUser.find({ _id: notificationPayload.userId });

    for (const appUser of appUsers) {
      if (!appUser.fcmToken) continue;

      const [title, body] = await Utils.compareAverageNeckAngle(notificationPayload.averageNeckAngle);
      const pushNotificationModel = {
        to: appUser.fcmToken,
        title,
        body,
        data: { type: 'average_angle_report' },
      };

      const sent = await PushNotificationDriver.sendPushNotification(pushNotificationModel);
      if (sent) {
        const responseRate = new ResponseRate({
          appUserId: appUser._id,
          dateCreated: new Date(),
          prompt: 1,
          response: 0,
        });

        await responseRate.save();
      }
    }

    return true;
  }

  static async postRandomBatchNeckAngleRecordForTestAsync(
    model: AutomatePostNeckAngleRecordsViewModel
  ): Promise<boolean> {
    if (model.numberOfRecords > 30) {
      throw new CustomException('The maximum number of records allowed is 30 per request');
    }

    const neckAngleRecords: INeckAngleRecord[] = [];
    const random = () => Math.floor(Math.random() * (90 - 10 + 1)) + 10;

    for (let i = 0; i < model.numberOfRecords; i++) {
      const angle = random();
      const start = new Date(model.startDate);
      const end = new Date(model.endDate);
      const timeSpanMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
      const randomMinutes = Math.floor(Math.random() * timeSpanMinutes);
      const randomDate = new Date(start.getTime() + randomMinutes * 60 * 1000);

      const record = new NeckAngleRecordModel({
        appUserId: model.appUserId,
        angle,
        craniumVertebralAngle: getCraniumVertebralAngleFromNeckAngle(angle),
        dateTimeRecorded: randomDate,
        counter: 0,
      });

      neckAngleRecords.push(record);
    }

    await NeckAngleRecordModel.insertMany(neckAngleRecords);
    return true;
  }

  // Optional: Define defaultPrompt if needed
  static defaultPrompt = 5;

  static async getWeeklyChartData(userId: string): Promise<WeeklyChartDataViewModel> {
    const today = new Date();
    const startOfWeek = DateLibrary.startOfWeek(today);
    const endOfWeek = DateLibrary.endOfWeek(today);

    const records = await NeckAngleRecordModel.find({
      appUserId: userId,
      dateTimeRecorded: { $gte: startOfWeek, $lte: endOfWeek },
    }).lean();

    const daysMap = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const totals: { [key: number]: number } = {};
    const counts: { [key: number]: number } = {};

    for (const record of records) {
      const dayNum = record.dateTimeRecorded.getDay();
      totals[dayNum] = (totals[dayNum] || 0) + record.angle;
      counts[dayNum] = (counts[dayNum] || 0) + 1;
    }

    const result = {} as WeeklyChartDataViewModel;
    for (let i = 0; i < 7; i++) {
      result[daysMap[i]] = counts[i] ? +(totals[i] / counts[i]).toFixed(1) : 0;
    }

    return result;
  }

  static async computeNeckAngleParameters(userId: string): Promise<NeckAngleParametersViewModel> {
    try {
      const userDetails = await AppUser.findById(userId).exec();
      if (!userDetails) throw new CustomException('User not found');

      const today = new Date();
      const startOfDay = DateLibrary.startOfDay(today);
      const endOfDay = DateLibrary.endOfDay(today);
      const startOfWeek = DateLibrary.startOfWeek(today);
      const endOfWeek = DateLibrary.endOfWeek(today);
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();

      const recordsRaw = await NeckAngleRecordModel.find({ appUserId: userId }).exec();
      const records: AbbreviatedNeckAngleRecordViewModel[] = recordsRaw.map((r: any) => ({
        angle: r.angle,
        craniumVertebralAngle: r.craniumVertebralAngle,
        dateTimeRecorded:
          r.dateTimeRecorded instanceof Date ? r.dateTimeRecorded : new Date(r.dateTimeRecorded),
      }));

      const safeAvg = (arr: AbbreviatedNeckAngleRecordViewModel[]): number =>
        arr.length === 0 ? 0 : +(arr.reduce((s, a) => s + a.angle, 0) / arr.length).toFixed(1);

      const thisDay = records.filter(
        (r) => r.dateTimeRecorded >= startOfDay && r.dateTimeRecorded <= endOfDay
      );
      const thisWeek = records.filter(
        (r) => r.dateTimeRecorded >= startOfWeek && r.dateTimeRecorded <= endOfWeek
      );
      const thisMonth = records.filter(
        (r) =>
          r.dateTimeRecorded.getMonth() === currentMonth &&
          r.dateTimeRecorded.getFullYear() === currentYear
      );
      const thisYear = records.filter(
        (r) => r.dateTimeRecorded.getFullYear() === currentYear
      );

      const currentDayAverageNeckAngle = safeAvg(thisDay);
      const currentWeekAverageNeckAngle = safeAvg(thisWeek);
      const currentMonthAverageNeckAngle = safeAvg(thisMonth);

      const averageNeckAngleForEachDayOfTheCurrentWeek =
        this.getEachDayOfTheWeekAverageNeckAngle(thisWeek);
      const withPositive = (await averageNeckAngleForEachDayOfTheCurrentWeek).filter(
        (d: DailyAngleDataViewModel) => d.averageNeckAngle > 0
      );

      let bestDay: DailyAngleDataViewModel | null = null;
      let badDay: DailyAngleDataViewModel | null = null;
      if (withPositive.length > 0) {
        bestDay = withPositive.reduce((a, b) => (a.averageNeckAngle >= b.averageNeckAngle ? a : b));
        badDay = withPositive.reduce((a, b) => (a.averageNeckAngle <= b.averageNeckAngle ? a : b));
        if (badDay && bestDay && badDay.day === bestDay.day) badDay = null;
      }

      // scoring
      let totalPoint = 0;
      for (const rec of records) {
        const a = rec.angle ?? 0;
        if (a >= 10 && a <= 19) totalPoint += 1;
        else if (a >= 20 && a <= 29) totalPoint += 2;
        else if (a >= 30 && a <= 39) totalPoint += 3;
        else if (a >= 40 && a <= 49) totalPoint += 4;
        else if (a >= 50) totalPoint += 5;
      }
      const averageNeckAngleStarRatingOver5 =
        records.length === 0 ? 0 : +(totalPoint / records.length).toFixed(2);

      // last goals
      const lastGoals = await Goal.find({ appUserId: userId })
        .sort({ _id: -1 })
        .limit(2)
        .lean()
        .exec();
      let lastSetGoalWithDetails: GoalCycleReportViewModel | null = null;
      if (lastGoals && lastGoals.length > 0) {
        const g = lastGoals[0] as any;
        lastSetGoalWithDetails = {
          frequency: g.frequency,
          targetedAverageNeckAngle: g.targetedAverageNeckAngle,
          actualAverageNeckAngle: null,
          complianceInPercentage: null,
          dateOfConcludedCycle: null,
          dayOfConcludedCycle: null,
          colorTag: null,
        };

        const goalReport = await GoalCycleCompletionReport.findOne({ goalId: g._id })
          .sort({ _id: -1 })
          .exec();
        if (goalReport) {
          lastSetGoalWithDetails.actualAverageNeckAngle = goalReport.actualAverageNeckAngle;
          lastSetGoalWithDetails.complianceInPercentage = goalReport.complianceInPercentage;
          lastSetGoalWithDetails.dateOfConcludedCycle = goalReport.dateOfConcludedCycle;
          lastSetGoalWithDetails.dayOfConcludedCycle = DateLibrary.formatDay(
            goalReport.dateOfConcludedCycle?.toString() ?? ''
          );
          lastSetGoalWithDetails.colorTag = Utils.getColorTag(
            goalReport.complianceInPercentage ?? 0
          );
        }
      }

      const averageNeckAngleForEachWeekOfTheCurrentMonth =
        await this.getEachWeekOfTheMonthAverageNeckAngle(thisMonth);

      const averageNeckAngleForEachMonthOfTheCurrentYear =
        this.getEachMonthOfTheYearAverageNeckAngle(thisYear);

      const currentDayAverageNeckAngleTextReport =
        Utils.currentDayAverageNeckAngleTextReport(currentDayAverageNeckAngle);

      return {
        username: userDetails.username,
        averageNeckAngleStarRatingOver5,
        responseRate: Math.round((userDetails.responseRate ?? 0) * 10) / 10,
        lastSetGoalWithDetails,
        dailyNeckAngleRecords: thisDay,
        weeklyNeckAngleRecords: thisWeek,
        monthlyNeckAngleRecords: thisMonth,
        currentDayAverageNeckAngle,
        currentWeekAverageNeckAngle,
        currentMonthAverageNeckAngle,
        bestWeekDayAverageNeckAngle: bestDay,
        badWeekDayAverageNeckAngle: badDay,
        averageNeckAngleForEachDayOfTheCurrentWeek,
        averageNeckAngleForEachWeekOfTheCurrentMonth:
          averageNeckAngleForEachWeekOfTheCurrentMonth.map((w) => ({
            weekNumber: w.week,
            averageNeckAngle: w.averageNeckAngle,
          })),
        averageNeckAngleForEachMonthOfTheCurrentYear,
        currentDayAverageNeckAngleTextReport,
      };
    } catch (error) {
      logger.error('Error in computeNeckAngleParametersAsync:', error);
      throw error instanceof CustomException
        ? error
        : new CustomException('Error computing neck angle parameters');
    }
  }
}