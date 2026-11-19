import { PushNotificationLog } from '../models/PushNotificationLog';
import { clearInvalidTokens, PushNotificationDriver } from '../services/pushNotificationDriver';
import { notifyPushFailure } from '../services/pushAlert.service';
import { scheduleExclusiveJob } from './jobLock';

const RECEIPT_MIN_AGE_MS = 15 * 60 * 1000;
const RECEIPT_EXPIRY_MS = 24 * 60 * 60 * 1000;
const RECEIPT_WINDOW_EXPIRED_ERROR = 'receipt window expired';
export const RECEIPT_BATCH_SIZE = 500;
const MAX_FAILURE_DETAILS = 40;

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw signal.reason instanceof Error ? signal.reason : new Error('Push receipt polling was aborted.');
  }
}

async function processPendingBatch(
  pendingLogs: any[],
  now: Date,
  onFailure: (label: string, error: string) => void,
  signal?: AbortSignal
): Promise<void> {
  throwIfAborted(signal);
  const ticketIds = pendingLogs
    .map((log) => log.ticketId)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);
  const receipts = ticketIds.length > 0 ? await PushNotificationDriver.getReceipts(ticketIds) : {};
  const writes: any[] = [];
  const invalidTokens: string[] = [];

  for (const log of pendingLogs) {
    const receipt = typeof log.ticketId === 'string' ? receipts[log.ticketId] : undefined;
    if (!receipt) continue;

    if (receipt.status === 'ok') {
      writes.push({
        updateOne: {
          filter: { _id: log._id, status: 'pending' },
          update: { $set: { status: 'delivered', deliveredAt: now } },
        },
      });
    } else {
      const error = receipt.details?.error ?? receipt.message ?? 'receipt error';
      writes.push({
        updateOne: {
          filter: { _id: log._id, status: 'pending' },
          update: { $set: { status: 'failed', error } },
        },
      });
      onFailure(`${log.dataType ?? log.title}: ${error}`, error);
      if (error === 'DeviceNotRegistered') invalidTokens.push(log.token);
    }
  }

  if (writes.length > 0) await PushNotificationLog.bulkWrite(writes, { ordered: false });
  await clearInvalidTokens(invalidTokens);
}

/** Polls and updates a bounded number of Expo receipt records at a time. */
export async function runPushReceiptPolling(
  now: Date = new Date(),
  signal?: AbortSignal
): Promise<number> {
  const staleCutoff = new Date(now.getTime() - RECEIPT_MIN_AGE_MS);
  const expiredCutoff = new Date(now.getTime() - RECEIPT_EXPIRY_MS);
  let expiredCount = 0;
  let pendingCount = 0;
  let failedCount = 0;
  const failureDescriptions: string[] = [];

  const noteFailure = (label: string) => {
    failedCount++;
    if (failureDescriptions.length < MAX_FAILURE_DETAILS) failureDescriptions.push(label);
  };

  const expiredCursor = PushNotificationLog.find({
    status: 'pending',
    ticketId: { $exists: true, $type: 'string', $gt: '' },
    sentAt: { $lte: expiredCutoff },
  })
    .select('_id')
    .cursor({ batchSize: RECEIPT_BATCH_SIZE });
  let expiredWrites: any[] = [];
  try {
    for await (const log of expiredCursor) {
      throwIfAborted(signal);
      expiredWrites.push({
        updateOne: {
          filter: { _id: log._id, status: 'pending' },
          update: { $set: { status: 'failed', error: RECEIPT_WINDOW_EXPIRED_ERROR } },
        },
      });
      expiredCount++;
      if (expiredWrites.length >= RECEIPT_BATCH_SIZE) {
        await PushNotificationLog.bulkWrite(expiredWrites, { ordered: false });
        expiredWrites = [];
      }
    }
    if (expiredWrites.length > 0) {
      await PushNotificationLog.bulkWrite(expiredWrites, { ordered: false });
    }
  } finally {
    await expiredCursor.close().catch(() => {});
  }

  if (expiredCount > 0) {
    failedCount += expiredCount;
    if (failureDescriptions.length < MAX_FAILURE_DETAILS) {
      failureDescriptions.push(`${expiredCount} push(es) abandoned (${RECEIPT_WINDOW_EXPIRED_ERROR})`);
    }
  }

  const pendingCursor = PushNotificationLog.find({
    status: 'pending',
    ticketId: { $exists: true, $type: 'string', $gt: '' },
    sentAt: { $gt: expiredCutoff, $lte: staleCutoff },
  })
    .select('_id ticketId token dataType title')
    .cursor({ batchSize: RECEIPT_BATCH_SIZE });
  let batch: any[] = [];
  try {
    for await (const log of pendingCursor) {
      throwIfAborted(signal);
      batch.push(log);
      pendingCount++;
      if (batch.length >= RECEIPT_BATCH_SIZE) {
        await processPendingBatch(batch, now, (label) => noteFailure(label), signal);
        batch = [];
      }
    }
    if (batch.length > 0) await processPendingBatch(batch, now, (label) => noteFailure(label), signal);
  } finally {
    await pendingCursor.close().catch(() => {});
  }

  if (failedCount > 0) {
    await notifyPushFailure(`Receipts: ${failedCount} push(es) not delivered (${failureDescriptions.join('; ')})`);
  }

  return expiredCount + pendingCount;
}

export const startPushReceiptsJob = () =>
  scheduleExclusiveJob(
    'pushReceipts',
    '*/15 * * * *',
    async (_scheduledAt, signal) =>
      `evaluated ${await runPushReceiptPolling(new Date(), signal)} pending entr(ies).`
  );
