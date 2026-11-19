import { CronJob } from 'cron';
import AppUser from '../models/AppUser';
import { logger } from '../utils/logger';

export class JobScheduler {
  private static jobs: Map<string, CronJob> = new Map();

  /**
   * Schedule a job to reset notification count for a user
   * Runs daily at 8:00 AM
   */
  public static scheduleResetNotificationCount(userId: string): void {
    const jobId = `Notification Count - ${userId}`;
    
    // Remove existing job if it exists
    this.removeJob(jobId);

    const job = new CronJob(
      '0 8 * * *', // Daily at 8:00 AM
      async () => {
        try {
          await this.resetNotificationCount(userId);
          logger.info(`Reset notification count for user ${userId}`);
        } catch (error: any) {
          logger.error(`Failed to reset notification count for user ${userId}: ${error.message}`);
        }
      },
      null, // onComplete
      true, // start immediately
      'UTC' // timezone
    );

    this.jobs.set(jobId, job);
    logger.info(`Scheduled notification count reset job for user ${userId}`);
  }

  /**
   * Reset notification count for a specific user
   */
  public static async resetNotificationCount(userId: string): Promise<void> {
    try {
      const user = await AppUser.findById(userId);
      if (user) {
        user.notificationCount = 0;
        await user.save();
        logger.info(`Reset notification count for user ${userId}`);
      } else {
        logger.warn(`User ${userId} not found when trying to reset notification count`);
        throw new Error(`User with ID ${userId} not found`);
      }
    } catch (error: any) {
      logger.error(`Error resetting notification count for user ${userId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Remove a specific job
   */
  public static removeJob(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (job) {
      job.stop();
      this.jobs.delete(jobId);
      logger.info(`Removed job: ${jobId}`);
    }
  }

  /**
   * Remove all jobs
   */
  public static removeAllJobs(): void {
    for (const [jobId, job] of this.jobs) {
      job.stop();
    }
    this.jobs.clear();
    logger.info('Removed all scheduled jobs');
  }

  /**
   * Get all active job IDs
   */
  public static getActiveJobIds(): string[] {
    return Array.from(this.jobs.keys());
  }

  /**
   * Add a generic cron job by ID and expression
   */
  public static addJob(jobId: string, cronExpression: string, callback: () => void | Promise<void>): void {
    this.removeJob(jobId);

    const job = new CronJob(
      cronExpression,
      callback,
      null,
      true,
      'UTC'
    );

    this.jobs.set(jobId, job);
    logger.info(`Added job ${jobId} with cron: ${cronExpression}`);
  }
}

