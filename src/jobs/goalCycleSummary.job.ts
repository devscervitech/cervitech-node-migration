import cron from 'node-cron';
import { runGoalCycleSummary } from '../services/goalCycleSummary.service';
import { logger } from '../utils/logger';

/**
 * Concludes goal cycles whose calendar period has elapsed, records the
 * compliance scorecard, and sends the "Your goal report" push.
 * Runs daily at 08:00 UTC — before the 10:00 goal-not-set reminder, so the
 * scorecard lands first. Idempotent per goal via the nextCycleEndsAt marker.
 */
export const startGoalCycleSummaryJob = () => {
  cron.schedule('0 8 * * *', async () => {
    logger.info('Running goal-cycle summary job...');
    try {
      const concluded = await runGoalCycleSummary();
      logger.info(`Goal-cycle summary job: concluded ${concluded} cycle(s).`);
    } catch (err: any) {
      logger.error(`Error in goal-cycle summary job: ${err.message}`);
    }
  });
};
