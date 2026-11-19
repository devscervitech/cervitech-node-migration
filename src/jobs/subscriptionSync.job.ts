import TransactionRecord from '../models/TransactionRecord';
import AppUser from '../models/AppUser';
import { GooglePlayService } from '../services/googlePlay.service';
import { TransactionService } from '../services/transaction.service';
import { AppUserService } from '../services/appUserServices/appUserService.service';
import { TRANSACTION_STATUS } from '../enums/transaction';
import { logger } from '../utils/logger';
import { scheduleExclusiveJob } from './jobLock';

export const FAILED_RECHECK_WINDOW_DAYS = 100;
const PENDING_RECHECK_MS = 15 * 60 * 1000;
const COMPLETED_RECHECK_MS = 24 * 60 * 60 * 1000;
const FAILED_RECHECK_MS = 60 * 60 * 1000;
const CURSOR_BATCH_SIZE = 250;

export type SubscriptionSyncSummary = {
  checkedUsers: number;
  verified: number;
  revoked: number;
  regranted: number;
};

const playStatusToTransactionStatus = (status: 'entitled' | 'pending' | 'not_entitled') =>
  status === 'entitled'
    ? TRANSACTION_STATUS.Completed
    : status === 'pending'
      ? TRANSACTION_STATUS.Pending
      : TRANSACTION_STATUS.Failed;

export const isFailedRecheckSlot = (scheduledAt: Date) => scheduledAt.getUTCMinutes() < 15;

function nextCheckAt(status: number, now: Date): Date {
  const interval =
    status === TRANSACTION_STATUS.Completed
      ? COMPLETED_RECHECK_MS
      : status === TRANSACTION_STATUS.Pending
        ? PENDING_RECHECK_MS
        : FAILED_RECHECK_MS;
  return new Date(now.getTime() + interval);
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw signal.reason instanceof Error ? signal.reason : new Error('Subscription sync was aborted.');
  }
}

type SyncUserState = {
  userId: string;
  anyEntitled: boolean;
  hasDeferredActiveRecord: boolean;
  verificationFailed: boolean;
  checked: boolean;
};

async function finishUser(
  state: SyncUserState,
  summary: SubscriptionSyncSummary,
  now: Date
): Promise<void> {
  if (!state.checked) return;
  summary.checkedUsers++;

  if (state.anyEntitled) {
    if (await AppUserService.ensurePaidEntitlement(state.userId)) {
      summary.regranted++;
      logger.info(`Restored hasPaid for user ${state.userId} (subscription entitled again).`);
    }
    return;
  }

  // A valid active record not due for polling still protects the entitlement.
  // Look it up with the per-user index instead of loading every future record
  // on every 15-minute sync. Transient errors also must never revoke a real sub.
  if (!state.verificationFailed) {
    state.hasDeferredActiveRecord = Boolean(await TransactionRecord.exists({
      appUserId: state.userId,
      purchaseToken: { $exists: true, $type: 'string', $gt: '' },
      status: { $in: [TRANSACTION_STATUS.Pending, TRANSACTION_STATUS.Completed] },
      nextVerificationAt: { $gt: now },
    }));
  }

  if (!state.verificationFailed && !state.hasDeferredActiveRecord) {
    const result = await AppUser.updateOne(
      { _id: state.userId, hasPaid: true },
      { $set: { hasPaid: false } }
    );
    if (result.modifiedCount > 0) {
      summary.revoked++;
      logger.info(`Revoked hasPaid for user ${state.userId} (no remaining entitled subscription).`);
    }
  }
}

/**
 * Reconciles Play entitlements in a cursor. Pending purchases are checked
 * every 15 minutes, completed subscriptions daily, and recently failed
 * purchases hourly for 100 days. A deferred active record prevents another
 * old/failed record from revoking the user's current entitlement.
 */
export async function runSubscriptionSync(
  now: Date = new Date(),
  options: { includeRecentlyFailed?: boolean; signal?: AbortSignal } = {}
): Promise<SubscriptionSyncSummary> {
  const includeRecentlyFailed = options.includeRecentlyFailed ?? isFailedRecheckSlot(now);
  const failedCutoff = new Date(now.getTime() - FAILED_RECHECK_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const dueVerification = {
    $or: [
      { nextVerificationAt: { $exists: false } },
      { nextVerificationAt: { $lte: now } },
    ],
  };
  const statusScope: Record<string, unknown>[] = [
    {
      status: { $in: [TRANSACTION_STATUS.Pending, TRANSACTION_STATUS.Completed] },
      ...dueVerification,
    },
  ];
  if (includeRecentlyFailed) {
    statusScope.push({
      status: TRANSACTION_STATUS.Failed,
      $and: [
        {
          $or: [
            { statusChangedAt: { $gte: failedCutoff } },
            { statusChangedAt: { $exists: false }, updatedAt: { $gte: failedCutoff } },
          ],
        },
        dueVerification,
      ],
    });
  }

  const cursor = TransactionRecord.find({
    purchaseToken: { $exists: true, $type: 'string', $gt: '' },
    $or: statusScope,
  })
    .select(
      '_id appUserId status purchaseToken packageName subscriptionId entitlementGranted updatedAt nextVerificationAt statusChangedAt'
    )
    .sort({ appUserId: 1, _id: 1 })
    .cursor({ batchSize: CURSOR_BATCH_SIZE });

  const summary: SubscriptionSyncSummary = {
    checkedUsers: 0,
    verified: 0,
    revoked: 0,
    regranted: 0,
  };
  let current: SyncUserState | undefined;

  try {
    for await (const record of cursor) {
      throwIfAborted(options.signal);
      const userId = String(record.appUserId);
      if (current && current.userId !== userId) {
        await finishUser(current, summary, now);
        current = undefined;
      }
      current ??= {
        userId,
        anyEntitled: false,
        hasDeferredActiveRecord: false,
        verificationFailed: false,
        checked: false,
      };

      const recordStatus = record.status;
      const isActive =
        recordStatus === TRANSACTION_STATUS.Pending || recordStatus === TRANSACTION_STATUS.Completed;
      const due = !record.nextVerificationAt || record.nextVerificationAt <= now;

      if (isActive && !due) {
        current.hasDeferredActiveRecord = true;
        continue;
      }

      if (recordStatus === TRANSACTION_STATUS.Failed && !includeRecentlyFailed) continue;

      current.checked = true;
      try {
        const verification = await GooglePlayService.verifySubscriptionPurchase({
          packageName: record.packageName!,
          subscriptionId: record.subscriptionId!,
          purchaseToken: record.purchaseToken!,
        });
        summary.verified++;

        const nextStatus = playStatusToTransactionStatus(verification.status);
        if (verification.status === 'entitled') current.anyEntitled = true;

        if (record.status !== nextStatus) record.statusChangedAt = now;
        else if (!record.statusChangedAt) record.statusChangedAt = record.updatedAt ?? now;
        record.status = nextStatus;
        record.nextVerificationAt = nextCheckAt(nextStatus, now);
        await record.save();

        if (verification.status === 'entitled' && !record.entitlementGranted) {
          await TransactionService.grantEntitlement(record);
        }
      } catch (error) {
        current.verificationFailed = true;
        // Throttle transient failures instead of calling Play on every slot.
        record.nextVerificationAt = new Date(now.getTime() + PENDING_RECHECK_MS);
        await record.save().catch(() => {});
        logger.error(`Failed to re-verify a subscription record for user ${userId}`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    if (current) await finishUser(current, summary, now);
  } finally {
    await cursor.close().catch(() => {});
  }

  return summary;
}

export const startSubscriptionSyncJob = () => {
  scheduleExclusiveJob(
    'subscriptionSync',
    '*/15 * * * *',
    async (scheduledAt, signal) => {
      if (!GooglePlayService.isConfigured()) return 'skipped: Play verification is not configured.';
      const summary = await runSubscriptionSync(new Date(), {
        includeRecentlyFailed: isFailedRecheckSlot(scheduledAt),
        signal,
      });
      return `${summary.checkedUsers} user(s) checked, ${summary.verified} record(s) verified, ${summary.revoked} revoked, ${summary.regranted} re-granted.`;
    }
  );
};
