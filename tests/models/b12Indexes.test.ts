import { describe, it, expect } from 'vitest';
import AppUser from '../../src/models/AppUser';
import { NeckAngleRecordModel } from '../../src/models/NeckAngleRecord';
import TransactionRecord from '../../src/models/TransactionRecord';
import TokenBlacklist from '../../src/models/TokenBlacklist';
import JobRun from '../../src/models/JobRun';
import JobLease from '../../src/models/JobLease';
import { Goal } from '../../src/models/Goal';
import { GoalCycleCompletionReport } from '../../src/models/GoalCycleCompletionReport';
import { PushNotificationLog } from '../../src/models/PushNotificationLog';
import ResponseRate from '../../src/models/ResponseRate';

// B12: the hot read paths each need an index. Schema-level checks — no
// database connection is opened (autoIndex only runs once connected).
const keysOf = (model: { schema: { indexes(): [Record<string, unknown>, Record<string, unknown>][] } }) =>
  model.schema.indexes();

describe('B12 indexes', () => {
  it('indexes neck-angle readings by user and recorded time', () => {
    expect(keysOf(NeckAngleRecordModel)).toContainEqual([
      { appUserId: 1, dateTimeRecorded: -1 },
      expect.anything(),
    ]);
    expect(keysOf(NeckAngleRecordModel)).toContainEqual([
      { appUserId: 1, counter: -1 },
      expect.anything(),
    ]);
  });

  it('indexes transactions by user and the token blacklist by token', () => {
    expect(TransactionRecord.schema.path('appUserId').options.index).toBe(true);
    // B4 uses uniqueness, which also provides the token lookup index.
    expect(TokenBlacklist.schema.path('token').options.unique).toBe(true);
    expect(keysOf(TokenBlacklist)).toContainEqual([
      { token: 1 },
      expect.objectContaining({ unique: true }),
    ]);
    expect(keysOf(ResponseRate)).toContainEqual([{ appUserId: 1 }, expect.anything()]);
  });

  it('expires job slot records via a TTL index, keeping the monthly ledger unique', () => {
    expect(keysOf(JobRun)).toContainEqual([{ expiresAt: 1 }, expect.objectContaining({ expireAfterSeconds: 0 })]);
    expect(keysOf(JobRun)).toContainEqual([{ job: 1, monthKey: 1 }, expect.objectContaining({ unique: true })]);
    expect(keysOf(JobLease)).toContainEqual([{ job: 1 }, expect.objectContaining({ unique: true })]);
  });

  it('indexes due goals and idempotent cycle reports', () => {
    expect(keysOf(Goal)).toContainEqual([{ nextCycleEndsAt: 1 }, expect.anything()]);
    expect(keysOf(Goal)).toContainEqual([{ appUserId: 1, dateSet: -1 }, expect.anything()]);
    expect(keysOf(GoalCycleCompletionReport)).toContainEqual([
      { goalId: 1, dateOfConcludedCycle: 1 },
      expect.objectContaining({ unique: true, partialFilterExpression: { goalId: { $exists: true } } }),
    ]);
  });

  it('indexes receipt polling and subscription synchronization fields', () => {
    expect(keysOf(PushNotificationLog)).toContainEqual([
      { status: 1, sentAt: 1, ticketId: 1 },
      expect.anything(),
    ]);
    expect(keysOf(TransactionRecord)).toContainEqual([
      { appUserId: 1, status: 1, nextVerificationAt: 1, statusChangedAt: 1 },
      expect.objectContaining({ partialFilterExpression: { purchaseToken: { $type: 'string' } } }),
    ]);
    expect(keysOf(TransactionRecord)).toContainEqual([
      { status: 1, nextVerificationAt: 1, appUserId: 1, statusChangedAt: 1 },
      expect.objectContaining({ partialFilterExpression: { purchaseToken: { $type: 'string' } } }),
    ]);
  });

  it('does not copy the readings index onto the users collection', () => {
    const userIndexKeys = keysOf(AppUser).map(([key]) => Object.keys(key).join(','));
    expect(userIndexKeys.some((k) => k.includes('neckAngleRecords'))).toBe(false);
    expect(userIndexKeys.some((k) => k.includes('nextCycleEndsAt'))).toBe(false);
    expect(userIndexKeys.some((k) => k.includes('goalCycleCompletionReports'))).toBe(false);
  });

  it('keeps the deprecated embedded readings out of every user load', () => {
    expect(AppUser.schema.path('neckAngleRecords').options.select).toBe(false);
    expect(AppUser.schema.path('neckAngleRecordCounter')).toBeDefined();
  });
});
