import cron from 'node-cron';
import { Types } from 'mongoose';
import AppUser from '../models/AppUser';
import JobRun from '../models/JobRun';
import { EmailUtils } from '../utils/EmailService/emailutils';
import { logger } from '../utils/logger';

const JOB_NAME = 'monthlyReminder';
const INACTIVE_DAYS = 30; // users inactive for 30+ days
const ABANDONED_RUN_MS = 2 * 60 * 60 * 1000; // a running record older than this is considered abandoned
const DEFAULT_SCHEDULE = '0 9 14 * *'; // 14th of every month at 09:00 UTC

export type ReminderRunResult = {
  outcome: 'ran' | 'skipped';
  totalFound: number;
  sent: number;
  failed: number;
};

export function monthKeyOf(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

async function markRunFailed(runId: Types.ObjectId, startedAt: Date, err: unknown): Promise<void> {
  await JobRun.updateOne({
    _id: runId,
  }, {
    $set: {
      status: 'failed',
      startedAt,
      completedAt: new Date(),
      durationMs: Date.now() - startedAt.getTime(),
      errorSummary: err instanceof Error ? err.message : String(err),
    },
  }).catch(() => {});
}

async function executeReminderRun(now: Date, runId: Types.ObjectId): Promise<ReminderRunResult> {
  const cutoff = new Date(now.getTime() - INACTIVE_DAYS * 24 * 60 * 60 * 1000);

  const inactiveUsers = await AppUser.find({
    email: { $exists: true, $ne: null },
    $or: [
      { lastLoginDateTime: { $lt: cutoff } },
      { lastLoginDateTime: { $exists: false } },
    ],
  });

  logger.info(`Found ${inactiveUsers.length} inactive users.`);

  let sent = 0;
  let failed = 0;

  for (const user of inactiveUsers) {
    try {
      await EmailUtils.sendReminderEmail(user.email, user.username);
      sent++;
      logger.info(`Reminder sent to ${user.email} (${user.username})`);
    } catch (err: any) {
      failed++;
      logger.error(`Failed to send reminder to ${user.email}: ${err.message}`);
    }
  }

  await JobRun.updateOne({ _id: runId }, {
    $set: {
      status: 'completed',
      completedAt: new Date(),
      durationMs: Date.now() - now.getTime(),
      totalFound: inactiveUsers.length,
      sent,
      failed,
    },
  });

  return { outcome: 'ran', totalFound: inactiveUsers.length, sent, failed };
}

/**
 * One monthly reminder run, guarded by the JobRun ledger. A unique
 * (job, monthKey) index means only the first writer gets to run the batch;
 * a concurrent second instance hits a duplicate key and is skipped.
 */
export async function runMonthlyReminder(now: Date = new Date()): Promise<ReminderRunResult> {
  const monthKey = monthKeyOf(now);

  let run;
  try {
    run = await JobRun.create({ job: JOB_NAME, monthKey, status: 'running', startedAt: now });
  } catch (err: any) {
    if (err?.code === 11000) {
      logger.info(`Monthly reminder already ran for ${monthKey}; skipping duplicate run.`);
      return { outcome: 'skipped', totalFound: 0, sent: 0, failed: 0 };
    }
    throw err;
  }

  try {
    return await executeReminderRun(now, run._id as Types.ObjectId);
  } catch (err) {
    await markRunFailed(run._id as Types.ObjectId, run.startedAt, err);
    throw err;
  }
}

/**
 * Boot catch-up: makes up for a missed 14th (server was down, or the process
 * died mid-run leaving an abandoned `running` record). Records that are
 * `completed`, `failed`, or freshly `running` are left alone.
 *
 * An abandoned record is closed as `failed` and then re-attempted through the
 * normal create path — the unique (job, monthKey) index makes that path
 * dedupe-safe even if two instances boot simultaneously.
 */
export async function runMonthlyReminderCatchUp(now: Date = new Date()): Promise<ReminderRunResult> {
  const monthKey = monthKeyOf(now);
  const existing = await JobRun.findOne({ job: JOB_NAME, monthKey });

  if (!existing) {
    return runMonthlyReminder(now);
  }

  const abandoned =
    existing.status === 'running' && now.getTime() - existing.startedAt.getTime() >= ABANDONED_RUN_MS;

  if (!abandoned) {
    logger.info(`Monthly reminder catch-up: no run needed for ${monthKey} (record ${existing.status}).`);
    return { outcome: 'skipped', totalFound: 0, sent: 0, failed: 0 };
  }

  logger.warn(`Monthly reminder catch-up: retrying abandoned run ${existing._id} for ${monthKey}.`);
  await JobRun.updateOne({ _id: existing._id }, {
    $set: { status: 'failed', completedAt: new Date(), errorSummary: 'abandoned; retried' },
  });

  return runMonthlyReminder(now);
}

export const startMonthlyReminderJob = () => {
  const schedule = process.env.REMINDER_CRON_SCHEDULE ?? DEFAULT_SCHEDULE;

  if (process.env.REMINDER_JOB_ENABLED === 'false') {
    logger.info('Monthly reminder job disabled via REMINDER_JOB_ENABLED=false.');
    return;
  }

  cron.schedule(
    schedule,
    async () => {
      logger.info('Running monthly inactivity reminder job...');
      try {
        const result = await runMonthlyReminder();
        logger.info(
          `Monthly reminder ${result.outcome}: ${result.sent} sent, ${result.failed} failed, ${result.totalFound} found.`
        );
      } catch (err: any) {
        logger.error(`Error in monthly reminder job: ${err.message}`);
      }
    },
    { timezone: 'UTC' }
  );

  logger.info(`Monthly reminder job scheduled: "${schedule}" (UTC).`);
};
