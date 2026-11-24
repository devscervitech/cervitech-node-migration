import { runGoalCycleSummary } from '../services/goalCycleSummary.service';
import { scheduleExclusiveJob } from './jobLock';

/**
 * Concludes goal cycles whose calendar period has elapsed, records the
 * compliance scorecard, and sends the "Your goal report" push.
 * Runs daily at 08:00 — before the 10:00 goal-not-set reminder, so the
 * scorecard lands first. One instance runs each day (B12 slot lock), and
 * each goal is also claimed with a compare-and-set on its nextCycleEndsAt.
 */
export const startGoalCycleSummaryJob = () =>
  scheduleExclusiveJob(
    'goalCycleSummary',
    '0 8 * * *',
    async (_scheduledAt, signal) => `concluded ${await runGoalCycleSummary(new Date(), signal)} cycle(s).`
  );
