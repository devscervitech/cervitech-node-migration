import { Types } from 'mongoose';
import AppUser from '../models/AppUser';
import JobRun from '../models/JobRun';
import { EmailUtils } from '../utils/EmailService/emailutils';
import { logger } from '../utils/logger';
import { scheduleExclusiveJob } from './jobLock';

const JOB_NAME = 'monthlyReminder';
const INACTIVE_DAYS = 30;
const ABANDONED_RUN_MS = 2 * 60 * 60 * 1000;
const DEFAULT_SCHEDULE = '0 9 14 * *';
const EMAIL_CONCURRENCY = 10;
const USER_CURSOR_BATCH_SIZE = 250;

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
  await JobRun.updateOne(
    { _id: runId, status: 'running' },
    {
      $set: {
        status: 'failed',
        completedAt: new Date(),
        durationMs: Date.now() - startedAt.getTime(),
        errorSummary: err instanceof Error ? err.message : String(err),
      },
    }
  ).catch(() => {});
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw signal.reason instanceof Error ? signal.reason : new Error('Reminder job was aborted.');
  }
}

async function executeReminderRun(
  now: Date,
  runId: Types.ObjectId,
  signal?: AbortSignal
): Promise<ReminderRunResult> {
  const cutoff = new Date(now.getTime() - INACTIVE_DAYS * 24 * 60 * 60 * 1000);
  const inactiveUsers = AppUser.find(
    {
      email: { $exists: true, $type: 'string', $gt: '' },
      deleted: { $ne: true },
      $or: [
        { lastLoginDateTime: { $lt: cutoff } },
        { lastLoginDateTime: { $exists: false } },
      ],
    },
    { email: 1, username: 1 }
  )
    .lean()
    .cursor({ batchSize: USER_CURSOR_BATCH_SIZE });

  let totalFound = 0;
  let sent = 0;
  let failed = 0;
  let group: { email: string; username: string }[] = [];

  const sendGroup = async () => {
    if (group.length === 0) return;
    throwIfAborted(signal);
    totalFound += group.length;
    const users = group;
    group = [];
    const results = await Promise.allSettled(
      users.map((user) => EmailUtils.sendReminderEmail(user.email, user.username))
    );
    results.forEach((result, index) => {
      const user = users[index];
      if (result.status === 'fulfilled') {
        sent++;
        logger.info(`Reminder sent to ${user.email} (${user.username})`);
      } else {
        failed++;
        logger.error(`Failed to send reminder to ${user.email}: ${result.reason?.message ?? result.reason}`);
      }
    });
  };

  try {
    for await (const user of inactiveUsers) {
      throwIfAborted(signal);
      group.push(user as unknown as { email: string; username: string });
      if (group.length >= EMAIL_CONCURRENCY) await sendGroup();
    }
    await sendGroup();

    await JobRun.updateOne(
      { _id: runId, status: 'running' },
      {
        $set: {
          status: 'completed',
          completedAt: new Date(),
          durationMs: Date.now() - now.getTime(),
          totalFound,
          sent,
          failed,
        },
      }
    );

    return { outcome: 'ran', totalFound, sent, failed };
  } finally {
    await inactiveUsers.close().catch(() => {});
  }
}

async function executeClaimedRun(
  now: Date,
  run: { _id: Types.ObjectId; startedAt: Date },
  signal?: AbortSignal
): Promise<ReminderRunResult> {
  try {
    return await executeReminderRun(now, run._id, signal);
  } catch (error) {
    await markRunFailed(run._id, run.startedAt, error);
    throw error;
  }
}

/** One monthly run. A unique job/month ledger prevents a second run in a month. */
export async function runMonthlyReminder(
  now: Date = new Date(),
  signal?: AbortSignal
): Promise<ReminderRunResult> {
  const monthKey = monthKeyOf(now);
  let run: { _id: Types.ObjectId; startedAt: Date };
  try {
    run = (await JobRun.create({ job: JOB_NAME, monthKey, status: 'running', startedAt: now })) as {
      _id: Types.ObjectId;
      startedAt: Date;
    };
  } catch (error: any) {
    if (error?.code === 11000) {
      logger.info(`Monthly reminder already ran for ${monthKey}; skipping duplicate run.`);
      return { outcome: 'skipped', totalFound: 0, sent: 0, failed: 0 };
    }
    throw error;
  }
  return executeClaimedRun(now, run, signal);
}

/**
 * Boot catch-up. A stale `running` row is reclaimed with one conditional
 * update; the same unique ledger row is reused, so simultaneous replicas
 * cannot each create a second retry row or both send the same email batch.
 */
export async function runMonthlyReminderCatchUp(
  now: Date = new Date(),
  signal?: AbortSignal
): Promise<ReminderRunResult> {
  const monthKey = monthKeyOf(now);
  const cutoff = new Date(now.getTime() - ABANDONED_RUN_MS);
  const existing = await JobRun.findOne({ job: JOB_NAME, monthKey });

  if (!existing) return runMonthlyReminder(now, signal);

  const abandoned = existing.status === 'running' && existing.startedAt <= cutoff;
  if (!abandoned) {
    logger.info(`Monthly reminder catch-up: no run needed for ${monthKey} (record ${existing.status}).`);
    return { outcome: 'skipped', totalFound: 0, sent: 0, failed: 0 };
  }

  const claimed = await JobRun.findOneAndUpdate(
    { _id: existing._id, status: 'running', startedAt: { $lte: cutoff } },
    {
      $set: { startedAt: now },
      $unset: { completedAt: '', durationMs: '', sent: '', failed: '', totalFound: '', errorSummary: '' },
    },
    { new: true }
  );
  if (!claimed) {
    return { outcome: 'skipped', totalFound: 0, sent: 0, failed: 0 };
  }

  logger.warn(`Monthly reminder catch-up: retrying abandoned run ${claimed._id} for ${monthKey}.`);
  return executeClaimedRun(now, claimed as { _id: Types.ObjectId; startedAt: Date }, signal);
}

export const startMonthlyReminderJob = () => {
  const schedule = process.env.REMINDER_CRON_SCHEDULE ?? DEFAULT_SCHEDULE;

  if (process.env.REMINDER_JOB_ENABLED === 'false') {
    logger.info('Monthly reminder job disabled via REMINDER_JOB_ENABLED=false.');
    return;
  }

  scheduleExclusiveJob(
    JOB_NAME,
    schedule,
    async (scheduledAt, signal) => {
      const result = await runMonthlyReminder(scheduledAt, signal);
      return `${result.outcome}: ${result.sent} sent, ${result.failed} failed, ${result.totalFound} found.`;
    },
    {},
    { timezone: 'UTC' }
  );

  logger.info(`Monthly reminder job scheduled: "${schedule}" (UTC).`);
};
