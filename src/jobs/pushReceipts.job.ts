import cron from 'node-cron';
import { PushNotificationLog } from '../models/PushNotificationLog';
import { clearInvalidToken, PushNotificationDriver } from '../services/pushNotificationDriver';
import { notifyPushFailure } from '../services/pushAlert.service';
import { logger } from '../utils/logger';

const RECEIPT_MIN_AGE_MS = 15 * 60 * 1000; // Expo receipts are available ~15 min after send
const RECEIPT_EXPIRY_MS = 24 * 60 * 60 * 1000; // Expo clears push receipts 24 h after send
const RECEIPT_WINDOW_EXPIRED_ERROR = 'receipt window expired';

/**
 * One polling pass: asks Expo for delivery receipts for every push that was
 * accepted but not yet confirmed, then updates the audit log — delivered,
 * failed (with the error), or still awaiting confirmation. Pending entries
 * past Expo's 24 h receipt window can never be confirmed (Expo has already
 * discarded the receipts), so they are closed as failed with "receipt window
 * expired" instead of being polled forever. DeviceNotRegistered tokens are
 * cleared so they stop being retried, and any confirmed or expired failures
 * are escalated via notifyPushFailure.
 *
 * Returns the number of audit entries evaluated.
 */
export async function runPushReceiptPolling(now: Date = new Date()): Promise<number> {
  const staleCutoff = new Date(now.getTime() - RECEIPT_MIN_AGE_MS);
  const expiredCutoff = new Date(now.getTime() - RECEIPT_EXPIRY_MS);

  const expiredLogs = await PushNotificationLog.find({
    status: 'pending',
    ticketId: { $exists: true },
    sentAt: { $lte: expiredCutoff },
  });
  const pendingLogs = await PushNotificationLog.find({
    status: 'pending',
    ticketId: { $exists: true },
    sentAt: { $gt: expiredCutoff, $lte: staleCutoff },
  });

  let expiredCount = 0;
  for (const log of expiredLogs) {
    log.status = 'failed';
    log.error = RECEIPT_WINDOW_EXPIRED_ERROR;
    await log.save();
    expiredCount++;
  }

  if (pendingLogs.length === 0 && expiredCount === 0) return 0;

  const ticketIds = pendingLogs
    .map((log) => log.ticketId)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);

  const receipts = ticketIds.length > 0 ? await PushNotificationDriver.getReceipts(ticketIds) : {};

  let failedCount = 0;
  const failures: string[] = [];

  for (const log of pendingLogs) {
    if (!log.ticketId) continue;
    const receipt = receipts[log.ticketId];
    if (!receipt) continue; // Expo hasn't confirmed yet — leave pending

    if (receipt.status === 'ok') {
      log.status = 'delivered';
      log.deliveredAt = now;
      await log.save();
    } else {
      const error = receipt.details?.error ?? receipt.message ?? 'receipt error';
      log.status = 'failed';
      log.error = error;
      await log.save();
      failedCount++;
      failures.push(`${log.dataType ?? log.title}: ${error}`);
      if (error === 'DeviceNotRegistered') {
        await clearInvalidToken(log.token);
      }
    }
  }

  if (failedCount > 0 || expiredCount > 0) {
    const parts: string[] = [];
    if (failedCount > 0) {
      parts.push(`Receipts: ${failedCount} push(es) not delivered (${failures.join('; ')})`);
    }
    if (expiredCount > 0) {
      parts.push(
        `Receipts: ${expiredCount} push(es) abandoned (${RECEIPT_WINDOW_EXPIRED_ERROR})`
      );
    }
    await notifyPushFailure(parts.join(' | '));
  }

  return expiredCount + pendingLogs.length;
}

export const startPushReceiptsJob = () => {
  cron.schedule('*/15 * * * *', async () => {
    logger.info('Running push receipts polling job...');
    try {
      const processed = await runPushReceiptPolling();
      logger.info(`Push receipts job: evaluated ${processed} pending entr(ies).`);
    } catch (err: any) {
      logger.error(`Error in push receipts job: ${err.message}`);
    }
  });
};
