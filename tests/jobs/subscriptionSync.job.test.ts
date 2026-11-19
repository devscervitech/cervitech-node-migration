import { describe, it, expect, vi, beforeEach } from 'vitest';

const recordFind = vi.fn();
const recordExists = vi.fn();
const userUpdateOne = vi.fn();
const verify = vi.fn();
const grantEntitlement = vi.fn();
const ensurePaidEntitlement = vi.fn();

const cursorFor = (records: any[]) => ({
  async *[Symbol.asyncIterator]() {
    for (const record of records) yield record;
  },
  close: vi.fn(async () => undefined),
});

vi.mock('../../src/models/TransactionRecord', () => ({
  default: {
    find: (...args: unknown[]) => recordFind(...args),
    exists: (...args: unknown[]) => recordExists(...args),
  },
}));
vi.mock('../../src/models/AppUser', () => ({
  default: { updateOne: (...args: unknown[]) => userUpdateOne(...args) },
}));
vi.mock('../../src/services/googlePlay.service', () => ({
  GooglePlayService: {
    verifySubscriptionPurchase: (...args: unknown[]) => verify(...args),
    isConfigured: () => true,
  },
}));
vi.mock('../../src/services/transaction.service', () => ({
  TransactionService: { grantEntitlement: (...args: unknown[]) => grantEntitlement(...args) },
}));
vi.mock('../../src/services/appUserServices/appUserService.service', () => ({
  AppUserService: { ensurePaidEntitlement: (...args: unknown[]) => ensurePaidEntitlement(...args) },
}));
vi.mock('../../src/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('../../src/jobs/jobLock', () => ({ scheduleExclusiveJob: vi.fn() }));

import {
  FAILED_RECHECK_WINDOW_DAYS,
  isFailedRecheckSlot,
  runSubscriptionSync,
} from '../../src/jobs/subscriptionSync.job';
import { TRANSACTION_STATUS } from '../../src/enums/transaction';

const TOP_OF_HOUR = new Date('2026-11-19T17:00:00Z');
const QUARTER_PAST = new Date('2026-11-19T17:15:00Z');
const scanCutoff = (date: Date) =>
  new Date(date.getTime() - FAILED_RECHECK_WINDOW_DAYS * 24 * 60 * 60 * 1000);

const record = (fields: Record<string, unknown> = {}): any => ({
  appUserId: 'u1',
  purchaseToken: 'tok',
  packageName: 'app.test',
  subscriptionId: 'premium',
  amount: 100,
  entitlementGranted: true,
  status: TRANSACTION_STATUS.Completed,
  updatedAt: new Date('2026-11-18T00:00:00Z'),
  save: vi.fn().mockResolvedValue(undefined),
  ...fields,
});

function returnRecords(records: any[]) {
  recordFind.mockImplementation(() => {
    const query: any = {
      select: () => query,
      sort: () => query,
      cursor: (options: unknown) => {
        query.cursorOptions = options;
        return cursorFor(records);
      },
    };
    return query;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  returnRecords([]);
  recordExists.mockResolvedValue(null);
  userUpdateOne.mockResolvedValue({ modifiedCount: 1 });
  ensurePaidEntitlement.mockResolvedValue(false);
  grantEntitlement.mockResolvedValue({});
});

describe('runSubscriptionSync — query and API-call bounds', () => {
  it('selects only records with nonempty string tokens and active statuses outside the hourly recovery slot', async () => {
    await runSubscriptionSync(QUARTER_PAST);

    expect(recordFind).toHaveBeenCalledWith({
      purchaseToken: { $exists: true, $type: 'string', $gt: '' },
      $or: [
        {
          status: { $in: [TRANSACTION_STATUS.Pending, TRANSACTION_STATUS.Completed] },
          $or: [
            { nextVerificationAt: { $exists: false } },
            { nextVerificationAt: { $lte: QUARTER_PAST } },
          ],
        },
      ],
    });
  });

  it('includes recently failed records once per hour and keeps a separate status-change cutoff', async () => {
    await runSubscriptionSync(TOP_OF_HOUR);

    expect(recordFind).toHaveBeenCalledWith({
      purchaseToken: { $exists: true, $type: 'string', $gt: '' },
      $or: [
        {
          status: { $in: [TRANSACTION_STATUS.Pending, TRANSACTION_STATUS.Completed] },
          $or: [
            { nextVerificationAt: { $exists: false } },
            { nextVerificationAt: { $lte: TOP_OF_HOUR } },
          ],
        },
        {
          status: TRANSACTION_STATUS.Failed,
          $and: [
            {
              $or: [
                { statusChangedAt: { $gte: scanCutoff(TOP_OF_HOUR) } },
                { statusChangedAt: { $exists: false }, updatedAt: { $gte: scanCutoff(TOP_OF_HOUR) } },
              ],
            },
            {
              $or: [
                { nextVerificationAt: { $exists: false } },
                { nextVerificationAt: { $lte: TOP_OF_HOUR } },
              ],
            },
          ],
        },
      ],
    });
    expect(isFailedRecheckSlot(TOP_OF_HOUR)).toBe(true);
    expect(isFailedRecheckSlot(QUARTER_PAST)).toBe(false);
  });

  it('does not call Play again while an active record is not due for verification', async () => {
    returnRecords([]);

    const summary = await runSubscriptionSync(TOP_OF_HOUR);

    expect(verify).not.toHaveBeenCalled();
    expect(userUpdateOne).not.toHaveBeenCalled();
    expect(summary).toEqual({ checkedUsers: 0, verified: 0, revoked: 0, regranted: 0 });
  });

  it('bounds record memory with a cursor and configured batch size', async () => {
    await runSubscriptionSync(QUARTER_PAST);
    const query = recordFind.mock.results[0].value;
    expect(query.cursorOptions).toEqual({ batchSize: 250 });
  });
});

describe('runSubscriptionSync — entitlement recovery', () => {
  it('restores hasPaid when an already-granted record becomes entitled again', async () => {
    const lapsed = record({
      status: TRANSACTION_STATUS.Failed,
      statusChangedAt: new Date(TOP_OF_HOUR.getTime() - 30 * 60 * 1000),
      entitlementGranted: true,
    });
    returnRecords([lapsed]);
    verify.mockResolvedValue({ status: 'entitled' });
    ensurePaidEntitlement.mockResolvedValue(true);

    const summary = await runSubscriptionSync(TOP_OF_HOUR);

    expect(ensurePaidEntitlement).toHaveBeenCalledWith('u1');
    expect(summary.regranted).toBe(1);
    expect(lapsed.status).toBe(TRANSACTION_STATUS.Completed);
    expect(lapsed.statusChangedAt).toEqual(TOP_OF_HOUR);
    expect(lapsed.save).toHaveBeenCalledTimes(1);
    expect(grantEntitlement).not.toHaveBeenCalled();
    expect(userUpdateOne).not.toHaveBeenCalled();
  });

  it('grants a newly entitled record once without verifying it a second time', async () => {
    const fresh = record({ status: TRANSACTION_STATUS.Pending, entitlementGranted: false });
    returnRecords([fresh]);
    verify.mockResolvedValue({ status: 'entitled' });

    await runSubscriptionSync(QUARTER_PAST);

    expect(verify).toHaveBeenCalledTimes(1);
    expect(grantEntitlement).toHaveBeenCalledWith(fresh);
    expect(fresh.nextVerificationAt).toEqual(new Date(QUARTER_PAST.getTime() + 24 * 60 * 60 * 1000));
  });

  it('rechecks a pending purchase after 15 minutes and schedules the next check', async () => {
    const pending = record({ status: TRANSACTION_STATUS.Pending });
    returnRecords([pending]);
    verify.mockResolvedValue({ status: 'pending' });

    await runSubscriptionSync(QUARTER_PAST);

    expect(pending.nextVerificationAt).toEqual(new Date(QUARTER_PAST.getTime() + 15 * 60 * 1000));
    expect(pending.status).toBe(TRANSACTION_STATUS.Pending);
    expect(pending.save).toHaveBeenCalledTimes(1);
  });

  it('revokes only when all active/recent records have verified as not entitled', async () => {
    returnRecords([record(), record({ purchaseToken: 'older' })]);
    verify.mockResolvedValue({ status: 'not_entitled' });

    const summary = await runSubscriptionSync(QUARTER_PAST);

    expect(userUpdateOne).toHaveBeenCalledWith(
      { _id: 'u1', hasPaid: true },
      { $set: { hasPaid: false } }
    );
    expect(summary.revoked).toBe(1);
    expect(ensurePaidEntitlement).not.toHaveBeenCalled();
  });

  it('does not count a revoke for a user who was already not paid', async () => {
    returnRecords([
      record({ status: TRANSACTION_STATUS.Failed, statusChangedAt: new Date(TOP_OF_HOUR.getTime() - 30 * 60 * 1000) }),
    ]);
    verify.mockResolvedValue({ status: 'not_entitled' });
    userUpdateOne.mockResolvedValue({ modifiedCount: 0 });

    const summary = await runSubscriptionSync(TOP_OF_HOUR);
    expect(summary.revoked).toBe(0);
  });

  it('keeps a user paid while a different subscription is still active', async () => {
    returnRecords([record({ purchaseToken: 'expired' }), record({ purchaseToken: 'current' })]);
    verify.mockImplementation(async ({ purchaseToken }: { purchaseToken: string }) => ({
      status: purchaseToken === 'current' ? 'entitled' : 'not_entitled',
    }));

    await runSubscriptionSync(QUARTER_PAST);

    expect(userUpdateOne).not.toHaveBeenCalled();
    expect(ensurePaidEntitlement).toHaveBeenCalledWith('u1');
  });

  it('does not revoke when one subscription is not due yet', async () => {
    returnRecords([record({ purchaseToken: 'expired' })]);
    recordExists.mockResolvedValueOnce({ _id: 'current' });
    verify.mockResolvedValue({ status: 'not_entitled' });

    await runSubscriptionSync(TOP_OF_HOUR);

    expect(verify).toHaveBeenCalledTimes(1);
    expect(userUpdateOne).not.toHaveBeenCalled();
  });

  it('never revokes on a transient Play API failure and delays the retry', async () => {
    const subscription = record({});
    returnRecords([subscription]);
    verify.mockRejectedValue(new Error('503'));

    const summary = await runSubscriptionSync(QUARTER_PAST);

    expect(userUpdateOne).not.toHaveBeenCalled();
    expect(summary.revoked).toBe(0);
    expect(subscription.nextVerificationAt).toEqual(new Date(QUARTER_PAST.getTime() + 15 * 60 * 1000));
    expect(subscription.save).toHaveBeenCalledTimes(1);
  });

  it('refreshes the verification schedule even when Play reports the same status', async () => {
    const unchanged = record({ status: TRANSACTION_STATUS.Completed });
    returnRecords([unchanged]);
    verify.mockResolvedValue({ status: 'entitled' });

    await runSubscriptionSync(QUARTER_PAST);

    expect(unchanged.save).toHaveBeenCalledTimes(1);
    expect(unchanged.statusChangedAt).toEqual(unchanged.updatedAt);
    expect(unchanged.nextVerificationAt).toEqual(new Date(QUARTER_PAST.getTime() + 24 * 60 * 60 * 1000));
  });
});
