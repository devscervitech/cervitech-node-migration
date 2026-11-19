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
import { Calculator } from '../../utils/calculator';
import { AutomatePostNeckAngleRecordsViewModel } from '../../viewmodels/AutomatePostNeckAngleRecords';
import { Goal } from '../../models/Goal';
import { GoalCycleCompletionReport } from '../../models/GoalCycleCompletionReport';
import { GOAL_FREQUENCY } from '../../enums/goalFrequency';

import { NeckAngleParametersViewModel } from '../../viewmodels/NeckAngleParameters.viewmodel';

import { DailyAngleDataViewModel } from '../../viewmodels/DailyAngleData.viewmodel';
import { GoalCycleReportViewModel } from '../../viewmodels/GoalCycleReport.viewmodel';
import { WeeklyChartDataViewModel } from '../../viewmodels/WeeklyChartData.viewmodel';
import {
  monthlyTotalsPipeline,
  serverTimeZone,
  starRatingPipeline,
} from './neckAngleAggregations';
import {
  MAX_NECK_ANGLE_BATCH_SIZE,
  MAX_RANDOM_NECK_ANGLE_RECORDS,
} from '../../validation/schemas/neckAngle.schema';

export class NeckAngleService {
  static async postBatchNeckAngleRecordAsync(neckAngleModel: NeckAngleModel): Promise<boolean> {
    const records = neckAngleModel?.neckAngleRecords;
    if (
      !Array.isArray(records) ||
      records.length === 0 ||
      records.length > MAX_NECK_ANGLE_BATCH_SIZE
    ) {
      throw new CustomException('Invalid neck-angle batch size');
    }

    const normalizedRecords = records.map((record) => {
      const dateTimeRecorded = record?.dateTimeRecorded
        ? new Date(record.dateTimeRecorded)
        : new Date(Number.NaN);
      if (!record || !Number.isFinite(record.angle) || !Number.isFinite(dateTimeRecorded.getTime())) {
        throw new CustomException('Invalid neck-angle record');
      }
      return { ...record, dateTimeRecorded };
    });

    // B12: grouped per user so each user costs a fixed number of queries
    // (reserve counters, insertMany, and — only when a prompt threshold is
    // crossed — one read of the previous readings) instead of four per record.
    const recordsByUser = new Map<string, typeof normalizedRecords>();
    for (const record of normalizedRecords) {
      const bucket = recordsByUser.get(record.appUserId) ?? [];
      bucket.push(record);
      recordsByUser.set(record.appUserId, bucket);
    }

    try {
      for (const [appUserId, userRecords] of recordsByUser) {
        await this.insertBatchForUser(appUserId, userRecords);
      }
      return true;
    } catch (error: any) {
      logger.error(error.message || 'Unhandled exception');
      throw error;
    }
  }

  private static async insertBatchForUser(
    appUserId: string,
    records: { angle: number; dateTimeRecorded: Date }[]
  ): Promise<void> {
    const reserved = await this.reserveCounters(appUserId, records.length);
    if (!reserved) {
      logger.warn(`AppUser ${appUserId} not found, skipping.`);
      return;
    }

    const docs = records.map((record, i) => ({
      appUserId,
      angle: record.angle,
      craniumVertebralAngle: getCraniumVertebralAngleFromNeckAngle(record.angle),
      dateTimeRecorded: record.dateTimeRecorded,
      counter: reserved.firstCounter + i,
    }));

    const { prompt } = reserved;
    const crossings = docs
      .map((doc, i) => (prompt > 0 && doc.counter % prompt === 0 ? i : -1))
      .filter((i) => i >= 0);

    // Read the readings that precede this batch before inserting it, so each
    // threshold's average covers exactly the last N readings up to that
    // record — the same window the per-record loop used to compute.
    const windowSize = NeckAngleService.numberOfRecordPostBeforeSendingAverageNeckAngle;
    const priorAngles =
      crossings.length > 0 ? await this.latestAngles(appUserId, windowSize) : [];

    await NeckAngleRecordModel.insertMany(docs, { ordered: true });

    if (crossings.length === 0) return;

    const angles = [...priorAngles, ...docs.map((d) => d.angle)];
    const averages = crossings.map((i) => {
      const end = priorAngles.length + i + 1;
      return this.averageOfLastSet(angles.slice(Math.max(0, end - windowSize), end));
    });

    for (const averageNeckAngle of averages) {
      const notificationPayload: SendAverageNeckAnglePushNotificationViewModel = {
        userId: appUserId,
        averageNeckAngle,
      };
      await this.sendPushNotificationMessageForAverageNeckAngle(notificationPayload);
    }
  }

  /**
   * Atomically reserves `count` consecutive counters for a user and returns
   * the first one plus the user's prompt. Two concurrent batches each get a
   * disjoint block, so the prompt-threshold check can't double-fire or skip.
   * Returns null when the user does not exist (nothing is written then).
   */
  private static async reserveCounters(
    appUserId: string,
    count: number
  ): Promise<{ firstCounter: number; prompt: number } | null> {
    // Increment only after the counter has been initialized. Two first-time
    // writers may compute the same historical maximum, but the conditional
    // seed below lets exactly one initialize it; both then reserve disjoint
    // blocks through MongoDB's atomic $inc.
    for (let attempt = 0; attempt < 5; attempt++) {
      const before = await AppUser.findOneAndUpdate(
        { _id: appUserId, neckAngleRecordCounter: { $type: 'number' } },
        { $inc: { neckAngleRecordCounter: count } },
        { returnDocument: 'before', projection: { prompt: 1, neckAngleRecordCounter: 1 } }
      ).lean<{ prompt?: number; neckAngleRecordCounter?: number } | null>();

      if (before && typeof before.neckAngleRecordCounter === 'number') {
        return {
          firstCounter: before.neckAngleRecordCounter + 1,
          prompt:
            Number.isInteger(before.prompt) && before.prompt! > 0
              ? before.prompt!
              : NeckAngleService.defaultPrompt,
        };
      }

      if (!(await AppUser.exists({ _id: appUserId }))) return null;

      const [latest, embedded] = await Promise.all([
        NeckAngleRecordModel.findOne({ appUserId })
          .sort({ counter: -1 })
          .select('counter')
          .lean<{ counter?: number } | null>(),
        AppUser.aggregate<{ maxCounter?: number }>([
          { $match: { _id: Types.ObjectId.isValid(appUserId) ? new Types.ObjectId(appUserId) : appUserId } },
          {
            $project: {
              maxCounter: {
                $max: {
                  $map: {
                    input: { $ifNull: ['$neckAngleRecords', []] },
                    as: 'record',
                    in: { $ifNull: ['$$record.counter', 0] },
                  },
                },
              },
            },
          },
        ]).then((rows) => rows[0] ?? null),
      ]);

      const base = Math.max(latest?.counter ?? 0, embedded?.maxCounter ?? 0, 0);
      const seeded = await AppUser.findOneAndUpdate(
        { _id: appUserId, neckAngleRecordCounter: { $not: { $type: 'number' } } },
        { $set: { neckAngleRecordCounter: base } },
        { returnDocument: 'after', projection: { neckAngleRecordCounter: 1 } }
      ).lean<{ neckAngleRecordCounter?: number } | null>();
      if (!seeded) continue;
    }

    throw new Error(`Could not initialize the neck-angle counter for user ${appUserId}.`);
  }

  /** Up to `limit` latest counter-ordered angles for a user, oldest first. */
  private static async latestAngles(appUserId: string, limit: number): Promise<number[]> {
    const latest = await NeckAngleRecordModel.find({ appUserId })
      .sort({ counter: -1 })
      .limit(limit)
      .select('angle')
      .lean<{ angle: number }[]>();
    return latest.map((r) => r.angle).reverse();
  }

  /** Last configured number of samples, without changing the response-rate metric. */
  static async calculateAverageOfLastSetNeckAngles(userId: string): Promise<number> {
    const angles = await this.latestAngles(
      userId,
      NeckAngleService.numberOfRecordPostBeforeSendingAverageNeckAngle
    );
    if (angles.length === 0) throw new Error('No records found for this user');
    return this.averageOfLastSet(angles);
  }

  /**
   * Average reported in the prompt push. Preserve B4's behavior of dividing
   * by the available samples when a user has fewer than the configured window.
   */
  private static averageOfLastSet(angles: number[]): number {
    const sum = angles.reduce((total, angle) => total + angle, 0);
    const average = angles.length === 0 ? 0 : Math.round((sum / angles.length) * 10) / 10;
    return Number.isNaN(average) ? 0 : average;
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

  /** Same output as getEachMonthOfTheYearAverageNeckAngle, from per-month totals. */
  static monthlyAveragesFromTotals(
    totals: { _id: number; total: number; count: number }[]
  ): { month: string; averageNeckAngle: number }[] {
    const monthsMap = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    const byMonth = new Map(totals.map((t) => [t._id, t]));
    return monthsMap.map((month, i) => {
      const t = byMonth.get(i + 1); // $month is 1-12
      return { month, averageNeckAngle: t && t.count > 0 ? t.total / t.count : 0 };
    });
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
    const start = model?.startDate ? new Date(model.startDate) : new Date(Number.NaN);
    const end = model?.endDate ? new Date(model.endDate) : new Date(Number.NaN);
    if (
      !model ||
      typeof model.appUserId !== 'string' ||
      model.appUserId.trim().length === 0 ||
      !Number.isInteger(model.numberOfRecords) ||
      model.numberOfRecords < 1 ||
      model.numberOfRecords > MAX_RANDOM_NECK_ANGLE_RECORDS ||
      !Number.isFinite(start.getTime()) ||
      !Number.isFinite(end.getTime()) ||
      end.getTime() <= start.getTime()
    ) {
      throw new CustomException('Invalid random neck-angle batch request');
    }

    const neckAngleRecords: INeckAngleRecord[] = [];
    const random = () => Math.floor(Math.random() * (90 - 10 + 1)) + 10;

    for (let i = 0; i < model.numberOfRecords; i++) {
      const angle = random();
      const timeSpanMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
      const randomMinutes = Math.floor(Math.random() * timeSpanMinutes);
      const randomDate = new Date(start.getTime() + randomMinutes * 60 * 1000);

      const record = new NeckAngleRecordModel({
        appUserId: model.appUserId,
        angle,
        craniumVertebralAngle: Calculator.getCraniumVertebralAngleFromNeckAngle(angle),
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

  // static async calculateAverageOfLastWeekOrDay(
  //   userId: string,
  //   frequency: GOAL_FREQUENCY,
  //   dateCreated: Date,
  //   goalId: string
  // ): Promise<boolean> {
  //   try {
  //     let average = 0;

  //     let startDate: Date;
  //     let endDate: Date = DateLibrary.getCurrentDateTime();

  //     if (frequency === GOAL_FREQUENCY.DAILY) {
  //       startDate = DateLibrary.getYesterdayDateTime();
  //     } else if (frequency === GOAL_FREQUENCY.WEEKLY) {
  //       startDate = DateLibrary.getLastWeekDateTime();
  //     } else {
  //       throw new Error("Invalid Goal Frequency");
  //     }

  //     const records = await NeckAngleRecordModel.find({
  //       appUserId: new Types.ObjectId(userId),
  //       dateTimeRecorded: {
  //         $gte: startDate,
  //         $lte: endDate,
  //       },
  //     }).lean();

  //     if (records.length > 0) {
  //       average = records.reduce((sum, r) => sum + r.angle, 0) / records.length;
  //     }

  //     const goal = await Goal.findById(goalId);
  //     if (!goal) return false;

  //     let complianceInPercentage =
  //       average >= goal.targetedAverageNeckAngle
  //         ? 100
  //         : Math.round((average / goal.targetedAverageNeckAngle) * 100 * 10) / 10;

  //     complianceInPercentage = complianceInPercentage > 100 ? 100 : complianceInPercentage;

  //     if (isNaN(complianceInPercentage)) complianceInPercentage = 0;

  //     const report = new GoalCycleCompletionReport({
  //       actualAverageNeckAngle: isNaN(average)
  //         ? 0
  //         : Math.round(average * 10) / 10,
  //       complianceInPercentage,
  //       dateOfConcludedCycle: DateLibrary.getCurrentDateTime(),
  //       goalId: new Types.ObjectId(goalId),
  //     });

  //     await report.save();

  //     const userFCMToken = await getFCMTokenById(userId); // implement separately

  //     if (userFCMToken && userFCMToken.trim() !== "") {
  //       const pushNotificationModel = {
  //         to: userFCMToken,
  //         title: "Your set goal",
  //         body: `Hi, you scored ${Math.round(report.complianceInPercentage * 10) / 10}/100`,
  //       };

  //       await PushNotificationDriver.sendPushNotification(pushNotificationModel); // implement separately
  //     } else {
  //       throw new Error("User does not have an FCM Token");
  //     }

  //     return true;
  //   } catch (err) {
  //     console.error("Error in calculateAverageOfLastWeekOrDay:", err);
  //     throw err;
  //   }
  // }

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
      const today = new Date();
      const startOfDay = DateLibrary.startOfDay(today);
      const endOfDay = DateLibrary.endOfDay(today);
      const startOfWeek = DateLibrary.startOfWeek(today);
      const endOfWeek = DateLibrary.endOfWeek(today);
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();
      const startOfMonth = new Date(currentYear, currentMonth, 1);
      const startOfNextMonth = new Date(currentYear, currentMonth + 1, 1);
      const startOfYear = new Date(currentYear, 0, 1);
      const startOfNextYear = new Date(currentYear + 1, 0, 1);

      // B12: this used to load every reading the user ever posted. Raw
      // readings are now fetched only for the window the response actually
      // lists (day ⊂ week, plus the month — the week can straddle a month or
      // year boundary, hence min/max). The year view and the lifetime star
      // rating are aggregated inside MongoDB, so only a dozen small documents
      // come back regardless of history size.
      const recentFrom = new Date(
        Math.min(startOfDay.getTime(), startOfWeek.getTime(), startOfMonth.getTime())
      );
      const recentTo = new Date(
        Math.max(endOfDay.getTime(), endOfWeek.getTime(), startOfNextMonth.getTime() - 1)
      );
      const appUserId = String(userId);
      const responseRateUserId = Types.ObjectId.isValid(userId)
        ? new Types.ObjectId(userId)
        : userId;

      const [userDetails, recordsRaw, monthTotals, ratingTotals, responseRateTotals] = await Promise.all([
        AppUser.findById(userId).select('username').lean<any>().exec(),
        NeckAngleRecordModel.find({
          appUserId,
          dateTimeRecorded: { $gte: recentFrom, $lte: recentTo },
        })
          .sort({ dateTimeRecorded: 1 })
          .select({ _id: 0, angle: 1, craniumVertebralAngle: 1, dateTimeRecorded: 1 })
          .lean()
          .exec(),
        NeckAngleRecordModel.aggregate<{ _id: number; total: number; count: number }>(
          monthlyTotalsPipeline(appUserId, startOfYear, startOfNextYear, serverTimeZone())
        ).exec(),
        NeckAngleRecordModel.aggregate<{ points: number; count: number }>(
          starRatingPipeline(appUserId)
        ).exec(),
        ResponseRate.aggregate<{ prompts: number; responses: number }>([
          { $match: { appUserId: responseRateUserId } },
          {
            $group: {
              _id: null,
              prompts: { $sum: { $ifNull: ['$prompt', 0] } },
              responses: { $sum: { $ifNull: ['$response', 0] } },
            },
          },
        ]).exec(),
      ]);
      if (!userDetails) throw new CustomException('User not found');

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

      // Lifetime star rating (see neckAngleAggregations.ts for the bands).
      const rating = ratingTotals[0];
      const averageNeckAngleStarRatingOver5 =
        !rating || rating.count === 0 ? 0 : +(rating.points / rating.count).toFixed(2);

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
        this.monthlyAveragesFromTotals(monthTotals);

      const currentDayAverageNeckAngleTextReport =
        Utils.currentDayAverageNeckAngleTextReport(currentDayAverageNeckAngle);

      const responseTotals = responseRateTotals[0];
      const prompts = responseTotals?.prompts ?? 0;
      const responses = responseTotals?.responses ?? 0;
      return {
        username: userDetails.username,
        averageNeckAngleStarRatingOver5,
        responseRate: prompts > 0 ? Math.round(responses / prompts * 1000) / 10 : 0,
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
