import { randomUUID } from 'crypto';
import cron from 'node-cron';
import { Types } from 'mongoose';
import JobLease from '../models/JobLease';
import JobRun from '../models/JobRun';
import { logger } from '../utils/logger';

const DEFAULT_LEASE_MS = 2 * 60 * 1000;
const DEFAULT_HEARTBEAT_MS = 30 * 1000;
const DEFAULT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

export interface ExclusiveRunOptions {
  /** How long a crashed worker's lease remains owned without a heartbeat. */
  leaseMs?: number;
  /** How often a live worker renews its lease. Must be shorter than leaseMs. */
  heartbeatMs?: number;
  /** How long the per-slot history record remains before MongoDB's TTL removes it. */
  retentionMs?: number;
}

export type ExclusiveRunResult<T> =
  | { outcome: 'ran'; result: T }
  | { outcome: 'skipped'; reason: 'slot-taken' | 'still-running' };

/** UTC minute of the scheduled firing, e.g. `2026-11-19T17:00`. */
export function slotKeyOf(scheduledAt: Date): string {
  return scheduledAt.toISOString().slice(0, 16);
}

function isDuplicateKey(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 11000;
}

async function acquireLease(job: string, ownerToken: string, now: Date, leaseMs: number) {
  try {
    const lease = await JobLease.findOneAndUpdate(
      {
        job,
        $or: [{ leaseUntil: { $lte: now } }, { leaseUntil: { $exists: false } }],
      },
      {
        $set: {
          ownerToken,
          leaseUntil: new Date(now.getTime() + leaseMs),
          heartbeatAt: now,
        },
        $setOnInsert: { job },
      },
      { upsert: true, new: true }
    );
    return Boolean(lease && lease.ownerToken === ownerToken);
  } catch (error) {
    // When a live lease exists, upsert attempts to insert the same unique job
    // key. That duplicate-key race is the distributed "someone else owns it" result.
    if (isDuplicateKey(error)) return false;
    throw error;
  }
}

async function releaseLease(job: string, ownerToken: string): Promise<void> {
  // Compare ownerToken so a slow former owner cannot release a lease that has
  // already been reclaimed by another replica.
  await JobLease.updateOne(
    { job, ownerToken },
    { $set: { leaseUntil: new Date(0), heartbeatAt: new Date() } }
  );
}

export async function runExclusive<T>(
  job: string,
  scheduledAt: Date,
  fn: (signal: AbortSignal) => Promise<T>,
  options: ExclusiveRunOptions = {}
): Promise<ExclusiveRunResult<T>> {
  const leaseMs = options.leaseMs ?? DEFAULT_LEASE_MS;
  const heartbeatMs = options.heartbeatMs ?? Math.min(DEFAULT_HEARTBEAT_MS, Math.floor(leaseMs / 3));
  const retentionMs = options.retentionMs ?? DEFAULT_RETENTION_MS;
  if (leaseMs <= 0 || heartbeatMs <= 0 || heartbeatMs >= leaseMs) {
    throw new Error('Job lease heartbeat must be positive and shorter than its lease.');
  }

  const ownerToken = randomUUID();
  const startedAt = new Date();
  const acquired = await acquireLease(job, ownerToken, startedAt, leaseMs);
  if (!acquired) return { outcome: 'skipped', reason: 'still-running' };

  let runId: Types.ObjectId | undefined;
  let leaseOwned = true;
  let heartbeatInFlight: Promise<void> | undefined;
  const controller = new AbortController();
  const heartbeat = setInterval(() => {
    if (heartbeatInFlight || !leaseOwned) return;
    heartbeatInFlight = (async () => {
      try {
        const result = await JobLease.updateOne(
          { job, ownerToken },
          { $set: { leaseUntil: new Date(Date.now() + leaseMs), heartbeatAt: new Date() } }
        );
        if (result.matchedCount !== 1) {
          leaseOwned = false;
          controller.abort(new Error(`Lease for ${job} was taken by another worker.`));
        }
      } catch (error) {
        leaseOwned = false;
        controller.abort(error);
        logger.error(`Job lease heartbeat failed for ${job}.`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    })().finally(() => {
      heartbeatInFlight = undefined;
    });
  }, heartbeatMs);
  heartbeat.unref?.();

  try {
    let run;
    try {
      run = await JobRun.create({
        job,
        monthKey: slotKeyOf(scheduledAt),
        status: 'running',
        startedAt,
        expiresAt: new Date(startedAt.getTime() + retentionMs),
      });
    } catch (error) {
      if (isDuplicateKey(error)) return { outcome: 'skipped', reason: 'slot-taken' };
      throw error;
    }
    runId = run._id as Types.ObjectId;

    const result = await fn(controller.signal);
    if (controller.signal.aborted || !leaseOwned) {
      throw new Error(`Job ${job} stopped because its distributed lease was lost.`);
    }

    // Final compare-and-set proves we still own the lease before writing the
    // success record. A former owner cannot mark a reclaimed run successful.
    const ownership = await JobLease.updateOne(
      { job, ownerToken, leaseUntil: { $gt: new Date() } },
      { $set: { leaseUntil: new Date(Date.now() + leaseMs), heartbeatAt: new Date() } }
    );
    if (ownership.matchedCount !== 1) {
      leaseOwned = false;
      controller.abort(new Error(`Lease for ${job} was taken by another worker.`));
      throw new Error(`Job ${job} stopped because its distributed lease was lost.`);
    }

    await JobRun.updateOne(
      { _id: runId, status: 'running' },
      {
        $set: {
          status: 'completed',
          completedAt: new Date(),
          durationMs: Date.now() - startedAt.getTime(),
        },
      }
    );
    return { outcome: 'ran', result };
  } catch (error) {
    if (runId) {
      await JobRun.updateOne(
        { _id: runId, status: 'running' },
        {
          $set: {
            status: 'failed',
            completedAt: new Date(),
            durationMs: Date.now() - startedAt.getTime(),
            errorSummary: error instanceof Error ? error.message : String(error),
          },
        }
      ).catch(() => {});
    }
    throw error;
  } finally {
    clearInterval(heartbeat);
    // Do not release before a pending renewal completes: otherwise a slow
    // heartbeat could extend the lease again after this worker released it.
    await heartbeatInFlight?.catch(() => {});
    await releaseLease(job, ownerToken).catch((error) => {
      logger.error(`Failed to release job lease for ${job}.`, {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }
}

/**
 * cron.schedule + a durable MongoDB lease + per-slot run history. Every
 * scheduled callback on every replica uses the same unique lease row. A
 * heartbeat keeps long jobs from appearing abandoned; an expired lease can
 * be reclaimed after a process crash.
 */
export function scheduleExclusiveJob(
  job: string,
  expression: string,
  fn: (scheduledAt: Date, signal: AbortSignal) => Promise<string>,
  options: ExclusiveRunOptions = {},
  scheduleOptions: Record<string, unknown> = {}
): void {
  cron.schedule(expression, async (context) => {
    const scheduledAt = context?.date instanceof Date ? context.date : new Date();
    try {
      const run = await runExclusive(job, scheduledAt, (signal) => fn(scheduledAt, signal), options);
      if (run.outcome === 'ran') {
        logger.info(`${job}: ${run.result}`);
      } else {
        logger.info(`${job}: skipped (${run.reason}) — another instance owns this run.`);
      }
    } catch (err: any) {
      logger.error(`Error in ${job} job: ${err?.message ?? String(err)}`);
    }
  }, scheduleOptions as any);
}
