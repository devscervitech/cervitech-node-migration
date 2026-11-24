import AppUser from '../models/AppUser';
import { Goal } from '../models/Goal';
import { NeckAngleRecordModel } from '../models/NeckAngleRecord';
import { GoalCycleCompletionReport } from '../models/GoalCycleCompletionReport';
import { PushNotificationDriver } from './pushNotificationDriver';
import { PushNotificationModelDTO } from '../types/pushNotificationModel.types';
import { GOAL_FREQUENCY } from '../enums/goalFrequency';
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

const SUPPORTED_FREQUENCIES = [GOAL_FREQUENCY.DAILY, GOAL_FREQUENCY.WEEKLY];
const GOAL_CURSOR_BATCH_SIZE = 200;
const PUSH_BATCH_SIZE = 100;

function mostRecentConcludedEnd(now: Date, firstCycleEndsAt: Date, frequency: CycleFrequency): Date {
  const elapsedCycles = Math.max(
    0,
    Math.floor((now.getTime() - firstCycleEndsAt.getTime()) / cycleDurationMs(frequency))
  );
  return new Date(firstCycleEndsAt.getTime() + elapsedCycles * cycleDurationMs(frequency));
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw signal.reason instanceof Error ? signal.reason : new Error('Goal summary job was aborted.');
  }
}

async function flushPushes(pushes: PushNotificationModelDTO[]): Promise<void> {
  if (pushes.length === 0) return;
  const batch = pushes.splice(0, pushes.length);
  try {
    await PushNotificationDriver.sendBatch(batch);
  } catch (error: any) {
    logger.error(`Goal-cycle summary push batch failed: ${error?.message ?? String(error)}`);
  }
}

type GoalMarker = {
  _id: unknown;
  appUserId: string;
  targetedAverageNeckAngle: number;
  frequency: string;
  dateSet: Date;
  nextCycleEndsAt?: Date;
};

async function advanceMarker(goalId: unknown, expectedMarker: Date | { $exists: false }, next: Date) {
  return Goal.updateOne(
    { _id: goalId, nextCycleEndsAt: expectedMarker },
    { $set: { nextCycleEndsAt: next } }
  );
}

async function concludeGoal(
  goal: GoalMarker,
  now: Date,
  pushes: PushNotificationModelDTO[],
  signal?: AbortSignal
): Promise<boolean> {
  throwIfAborted(signal);
  if (!isSupportedFrequency(goal.frequency)) return false;

  const frequency = goal.frequency;
  const firstCycleEndsAt = computeFirstCycleEndsAt(goal.dateSet, frequency);
  const cycleEndsAt = goal.nextCycleEndsAt ?? mostRecentConcludedEnd(now, firstCycleEndsAt, frequency);
  const expectedMarker: Date | { $exists: false } =
    goal.nextCycleEndsAt ?? { $exists: false as const };
  const nextCycleEndsAt = advanceCycleEndsAt(cycleEndsAt, frequency);

  // Legacy goals whose first cycle is still in progress get a future marker
  // and are then absent from the legacy scan until their first cycle ends.
  if (cycleEndsAt > now) {
    await advanceMarker(goal._id, expectedMarker, cycleEndsAt);
    return false;
  }

  const user = await AppUser.findById(goal.appUserId);
  if (!user || user.deleted || user.isGoalOn !== true) {
    // Move inactive goals beyond the current cycle. Otherwise every daily job
    // would repeatedly fetch the same due goal forever.
    await advanceMarker(goal._id, expectedMarker, nextCycleEndsAt);
    return false;
  }

  const newestGoal = await Goal.findOne({ appUserId: user._id })
    .sort({ dateSet: -1 })
    .select('_id');
  if (newestGoal && newestGoal._id.toString() !== String(goal._id)) {
    await advanceMarker(goal._id, expectedMarker, nextCycleEndsAt);
    return false;
  }

  throwIfAborted(signal);
  const { start, end } = computeCycleWindow(cycleEndsAt, frequency);
  const [totals] = await NeckAngleRecordModel.aggregate<{ total: number; count: number }>([
    {
      $match: {
        appUserId: String(user._id),
        dateTimeRecorded: { $gte: start, $lt: end },
      },
    },
    { $group: { _id: null, total: { $sum: '$angle' }, count: { $sum: 1 } } },
  ]);

  const averageNeckAngle =
    totals && totals.count > 0 ? Math.round((totals.total / totals.count) * 10) / 10 : 0;
  const complianceInPercentage = computeCompliance(averageNeckAngle, goal.targetedAverageNeckAngle);

  // Persist the report before moving the cursor. If aggregation or persistence
  // fails, the marker stays due and the next job run retries. The unique
  // (goalId, cycle) index makes a crash/retry idempotent.
  let created = false;
  try {
    const write = await GoalCycleCompletionReport.updateOne(
      { goalId: goal._id, dateOfConcludedCycle: cycleEndsAt },
      {
        $setOnInsert: {
          actualAverageNeckAngle: averageNeckAngle,
          complianceInPercentage,
          dateOfConcludedCycle: cycleEndsAt,
          goalId: goal._id,
        },
      },
      { upsert: true }
    );
    created = write.upsertedCount === 1;
  } catch (error: any) {
    // A concurrent instance may have won the unique upsert race. In that case
    // the report already exists and the marker can safely advance.
    if (error?.code !== 11000) throw error;
  }

  throwIfAborted(signal);
  const markerUpdate = await advanceMarker(goal._id, expectedMarker, nextCycleEndsAt);
  if (markerUpdate.modifiedCount !== 1) return false;

  // Push is best-effort and is emitted only by the report creator. The durable
  // scorecard remains available if the process exits between report and push.
  if (created && user.fcmToken && user.allowPushNotifications) {
    const payload = buildGoalCyclePushPayload(complianceInPercentage, frequency);
    payload.to = user.fcmToken;
    pushes.push(payload);
    if (pushes.length >= PUSH_BATCH_SIZE) await flushPushes(pushes);
  }

  return true;
}

/**
 * Streams due and legacy goals in indexed cursors. Reports are durable before
 * their markers advance, so a process crash cannot silently lose a cycle.
 */
export async function runGoalCycleSummary(
  now: Date = new Date(),
  signal?: AbortSignal
): Promise<number> {
  const supported = { $in: SUPPORTED_FREQUENCIES };
  const projections = '_id appUserId targetedAverageNeckAngle frequency dateSet nextCycleEndsAt';
  const dueGoals = Goal.find({
    frequency: supported,
    nextCycleEndsAt: { $exists: true, $lte: now },
  })
    .select(projections)
    .cursor({ batchSize: GOAL_CURSOR_BATCH_SIZE });
  const legacyGoals = Goal.find({
    frequency: supported,
    nextCycleEndsAt: { $exists: false },
  })
    .select(projections)
    .cursor({ batchSize: GOAL_CURSOR_BATCH_SIZE });

  const pushes: PushNotificationModelDTO[] = [];
  let concluded = 0;
  for (const cursor of [dueGoals, legacyGoals]) {
    try {
      for await (const goal of cursor) {
        throwIfAborted(signal);
        try {
          if (await concludeGoal(goal as unknown as GoalMarker, now, pushes, signal)) concluded++;
        } catch (error: any) {
          if (signal?.aborted) throw error;
          logger.error(`Goal-cycle summary failed for goal ${goal._id}: ${error?.message ?? String(error)}`);
        }
      }
    } finally {
      await cursor.close().catch(() => {});
    }
  }

  throwIfAborted(signal);
  await flushPushes(pushes);
  return concluded;
}
