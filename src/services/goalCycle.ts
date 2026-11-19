import { GOAL_FREQUENCY } from '../enums/goalFrequency';
import { PushNotificationModelDTO } from '../types/pushNotificationModel.types';

const DAY_MS = 24 * 60 * 60 * 1000;

export type CycleFrequency = 'DAILY' | 'WEEKLY';

export function isSupportedFrequency(frequency: string): frequency is CycleFrequency {
  return frequency === GOAL_FREQUENCY.DAILY || frequency === GOAL_FREQUENCY.WEEKLY;
}

export function cycleDurationMs(frequency: CycleFrequency): number {
  return frequency === GOAL_FREQUENCY.DAILY ? DAY_MS : 7 * DAY_MS;
}

function endOfDayUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1) - 1);
}

function startOfWeekUtc(date: Date): Date {
  const day = date.getUTCDay();
  const diff = (day === 0 ? -6 : 1) - day;
  const start = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + diff)
  );
  return start;
}

function endOfWeekUtc(date: Date): Date {
  return new Date(startOfWeekUtc(date).getTime() + 7 * DAY_MS - 1);
}

/**
 * First cycle ends at the end of the calendar day (DAILY) or the end of the
 * Monday-start calendar week (WEEKLY) containing dateSet, in UTC.
 */
export function computeFirstCycleEndsAt(dateSet: Date, frequency: CycleFrequency): Date {
  return frequency === GOAL_FREQUENCY.DAILY ? endOfDayUtc(dateSet) : endOfWeekUtc(dateSet);
}

export function advanceCycleEndsAt(cycleEndsAt: Date, frequency: CycleFrequency): Date {
  return new Date(cycleEndsAt.getTime() + cycleDurationMs(frequency));
}

/**
 * Window of records that count toward a concluded cycle. Because cycle ends
 * stay aligned to calendar boundaries, end - duration is exactly the previous
 * boundary (for the first cycle this covers the full calendar day/week).
 */
export function computeCycleWindow(
  cycleEndsAt: Date,
  frequency: CycleFrequency
): { start: Date; end: Date } {
  return { start: new Date(cycleEndsAt.getTime() - cycleDurationMs(frequency)), end: cycleEndsAt };
}

/**
 * Compliance score for a concluded cycle: average/target, rounded to 1dp,
 * capped at 100. Meets-or-beats target scores 100; missing data scores 0.
 */
export function computeCompliance(
  averageNeckAngle: number,
  targetedAverageNeckAngle: number
): number {
  if (!isFinite(averageNeckAngle) || averageNeckAngle <= 0) return 0;
  if (!isFinite(targetedAverageNeckAngle) || targetedAverageNeckAngle <= 0) return 0;
  if (averageNeckAngle >= targetedAverageNeckAngle) return 100;
  return Math.min(100, Math.round((averageNeckAngle / targetedAverageNeckAngle) * 100 * 10) / 10);
}

export function buildGoalCyclePushPayload(
  complianceInPercentage: number,
  frequency: CycleFrequency
): PushNotificationModelDTO {
  const score = Math.round(complianceInPercentage * 10) / 10;
  const period = frequency === GOAL_FREQUENCY.DAILY ? 'today' : 'this week';
  return {
    to: '',
    title: 'Your goal report 🎯',
    body: `You scored ${score}/100 ${period} — keep it up!`,
    data: { type: 'goal_cycle_report', frequency },
  };
}
