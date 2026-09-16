import cron from 'node-cron';
import TransactionRecord from '../models/TransactionRecord';
import AppUser from '../models/AppUser';
import { GooglePlayService } from '../services/googlePlay.service';
import { logger } from '../utils/logger';

// #09: keeps hasPaid accurate after the initial purchase.
//
// Approach chosen: polling, not RTDN/webhook. A webhook needs a Google Cloud
// Pub/Sub topic wired up in Play Console -- external config that doesn't
// exist yet. Polling needs nothing beyond the same Play Developer API access
// #08 already requires, so it's the only approach that can ship today. If
// RTDN is set up later, this job can be swapped for a webhook route without
// changing how entitlement is granted/revoked.
//
// Note: this only revokes hasPaid (cancel/expire/refund-by-expiry). It does
// not detect an immediate refund that predates the subscription's expiry --
// that requires polling `purchases.voidedpurchases.list` separately, which
// is out of scope here since it wasn't in the ticket's checklist.
export const startSubscriptionSyncJob = () => {
  const schedule = '0 4 * * *'; // daily at 4AM UTC

  cron.schedule(schedule, async () => {
    if (!GooglePlayService.isConfigured()) {
      logger.warn('Subscription sync job skipped: Play verification is not configured.');
      return;
    }

    logger.info('Running subscription sync job...');

    try {
      const records = await TransactionRecord.find({
        entitlementGranted: true,
        purchaseToken: { $exists: true, $ne: null },
      });

      // Grouped per user because a user can now have more than one
      // transaction record over their lifetime (resubscriptions, plan
      // changes, restores — see transaction.service.ts). Revoking on the
      // first not-entitled record seen would incorrectly strip hasPaid from
      // someone with a valid CURRENT subscription just because an old,
      // already-superseded record of theirs has since expired.
      const recordsByUser = new Map<string, typeof records>();
      for (const record of records) {
        const bucket = recordsByUser.get(record.appUserId) ?? [];
        bucket.push(record);
        recordsByUser.set(record.appUserId, bucket);
      }

      let revoked = 0;
      for (const [appUserId, userRecords] of recordsByUser) {
        let anyEntitled = false;
        let verificationFailed = false;

        for (const record of userRecords) {
          try {
            const verification = await GooglePlayService.verifySubscriptionPurchase({
              packageName: record.packageName!,
              subscriptionId: record.subscriptionId!,
              purchaseToken: record.purchaseToken!,
            });
            if (verification.status === 'entitled') anyEntitled = true;
          } catch (error) {
            // Can't confirm this record's state — don't let a transient
            // Play API failure count as "not entitled" and risk revoking a
            // real subscriber. See the outer catch: this just means this
            // user is skipped for this run, not incorrectly revoked.
            verificationFailed = true;
            logger.error(`Failed to re-verify a subscription record for user ${appUserId}`, {
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }

        if (!anyEntitled && !verificationFailed) {
          await AppUser.updateOne({ _id: appUserId }, { $set: { hasPaid: false } });
          revoked += 1;
          logger.info(`Revoked hasPaid for user ${appUserId} (no remaining entitled subscription).`);
        }
      }

      logger.info(
        `Subscription sync job completed. ${revoked} user(s) revoked out of ${recordsByUser.size} checked.`
      );
    } catch (error) {
      logger.error('Subscription sync job failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
};
