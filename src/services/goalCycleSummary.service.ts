import AppUser from '../models/AppUser';
import { Goal } from '../models/Goal';
import { NeckAngleRecordModel } from '../models/NeckAngleRecord';
import { GoalCycleCompletionReport } from '../models/GoalCycleCompletionReport';
import { PushNotificationDriver } from './pushNotificationDriver';
import { logger } from '../utils/logger';
import {
  CycleFrequency,
  advanceCycleEndsAt,
  buildGoalCyclePushPayload,
  computeCompliance,
  computeCycleWindow,
  computeFirstCycleEndsAt,
  cycleDurationMs,
  isSupportedFrequency,
} from './goalCycle';

/**
 * Most recent concluded-cycle boundary at or before `now`, used to bring
 * legacy goals (no `nextCycleEndsAt`) up to speed without reporting on
 * every historical cycle.
 */
function mostRecentConcludedEnd(
  now: Date,
  firstCycleEndsAt: Date,
  frequency: CycleFrequency
): Date {
  const duration = cycleDurationMs(frequency);
  const elapsedCycles = Math.max(
    0,
    Math.floor((now.getTime() - firstCycleEndsAt.getTime()) / duration)
  );
  return new Date(firstCycleEndsAt.getTime() + elapsedCycles * duration);
}

/**
 * One pass of the goal-cycle summary: finds goals whose current calendar
 * cycle has concluded, computes the compliance score for that cycle, records
 * it as a GoalCycleCompletionReport, advances the stored cycle marker, and
 * sends the "Your goal report" push to opted-in users with a token.
 *
 * The report is always written (it feeds the app's in-app scorecard); only
 * the push is skipped when the user lacks a token or opted out.
 *
 * Returns the number of cycles concluded.
 */
export async function runGoalCycleSummary(now: Date = new Date()): Promise<number> {
  const withMarker = await Goal.find({ nextCycleEndsAt: { $exists: true, $lte: now } });
  const withoutMarker = await Goal.find({ nextCycleEndsAt: { $exists: false } });
  let concluded = 0;

  for (const goal of [...withMarker, ...withoutMarker]) {
    const frequency = goal.frequency;
    if (!isSupportedFrequency(frequency)) continue;

    const user = await AppUser.findById(goal.appUserId);
    if (!user || user.deleted) continue;

    const firstCycleEndsAt = computeFirstCycleEndsAt(goal.dateSet, frequency);
    const cycleEndsAt = goal.nextCycleEndsAt
      ? goal.nextCycleEndsAt
      : mostRecentConcludedEnd(now, firstCycleEndsAt, frequency);
    const markerIsStale = !goal.nextCycleEndsAt;

    try {
      if (user.isGoalOn !== true) {
        if (markerIsStale) {
          await Goal.updateOne({ _id: goal._id }, { $set: { nextCycleEndsAt: cycleEndsAt } });
        }
        continue;
      }

      const newestGoal = await Goal.findOne({ appUserId: user._id })
        .sort({ dateSet: -1 })
        .select('_id');
      if (newestGoal && newestGoal._id.toString() !== goal._id.toString()) {
        if (markerIsStale) {
          await Goal.updateOne({ _id: goal._id }, { $set: { nextCycleEndsAt: cycleEndsAt } });
        }
        continue;
      }

      const { start, end } = computeCycleWindow(cycleEndsAt, frequency);
      const records = await NeckAngleRecordModel.find({
        appUserId: user._id,
        dateTimeRecorded: { $gte: start, $lt: end },
      });

      const averageNeckAngle =
        records.length > 0
          ? Math.round((records.reduce((sum, r) => sum + r.angle, 0) / records.length) * 10) / 10
          : 0;
      const complianceInPercentage = computeCompliance(
        averageNeckAngle,
        goal.targetedAverageNeckAngle
      );

      const report = new GoalCycleCompletionReport({
        actualAverageNeckAngle: averageNeckAngle,
        complianceInPercentage,
        dateOfConcludedCycle: cycleEndsAt,
        goalId: goal._id,
      });
      await report.save();

      await Goal.updateOne(
        { _id: goal._id },
        { $set: { nextCycleEndsAt: advanceCycleEndsAt(cycleEndsAt, frequency) } }
      );

      if (user.fcmToken && user.allowPushNotifications) {
        const payload = buildGoalCyclePushPayload(complianceInPercentage, frequency);
        payload.to = user.fcmToken;
        await PushNotificationDriver.sendPushNotification(payload);
      }

      concluded++;
    } catch (error: any) {
      logger.error(`Goal-cycle summary failed for goal ${goal._id}: ${error.message}`);
    }
  }

  return concluded;
}
