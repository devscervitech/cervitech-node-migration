import { describe, it, expect, vi, beforeEach } from 'vitest';

const ledger: any[] = [];
const leases = new Map<string, any>();
const scheduled: { expression: string; fn: (ctx: any) => Promise<void> }[] = [];
const jobRunCreate = vi.fn();
const jobRunUpdateOne = vi.fn();
const leaseFindOneAndUpdate = vi.fn();
const leaseUpdateOne = vi.fn();

vi.mock('../../src/models/JobRun', () => ({
  default: {
    create: (...args: unknown[]) => jobRunCreate(...args),
    updateOne: (...args: unknown[]) => jobRunUpdateOne(...args),
  },
}));

vi.mock('../../src/models/JobLease', () => ({
  default: {
    findOneAndUpdate: (...args: unknown[]) => leaseFindOneAndUpdate(...args),
    updateOne: (...args: unknown[]) => leaseUpdateOne(...args),
  },
}));

vi.mock('node-cron', () => ({
  default: {
    schedule: vi.fn((expression: string, fn: (ctx: any) => Promise<void>) => {
      scheduled.push({ expression, fn });
    }),
  },
}));

vi.mock('../../src/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { runExclusive, scheduleExclusiveJob, slotKeyOf } from '../../src/jobs/jobLock';
import { logger } from '../../src/utils/logger';

const SLOT = new Date('2026-11-19T17:00:00.000Z');

beforeEach(() => {
  vi.clearAllMocks();
  ledger.length = 0;
  leases.clear();
  scheduled.length = 0;
  jobRunCreate.mockImplementation(async (doc: any) => {
    if (ledger.some((row) => row.job === doc.job && row.monthKey === doc.monthKey)) {
      throw Object.assign(new Error('E11000 duplicate key'), { code: 11000 });
    }
    const row = { _id: `run-${ledger.length + 1}`, ...doc };
    ledger.push(row);
    return row;
  });
  jobRunUpdateOne.mockImplementation(async (filter: any, update: any) => {
    const row = ledger.find((entry) => entry._id === filter._id);
    if (row && (!filter.status || row.status === filter.status)) Object.assign(row, update.$set);
    return { matchedCount: row ? 1 : 0 };
  });
  leaseFindOneAndUpdate.mockImplementation(async (filter: any, update: any) => {
    const current = leases.get(filter.job);
    const now = filter.$or[0].leaseUntil.$lte as Date;
    if (current && current.leaseUntil > now) {
      throw Object.assign(new Error('E11000 duplicate key'), { code: 11000 });
    }
    const next = { job: filter.job, ...current, ...update.$set };
    leases.set(filter.job, next);
    return next;
  });
  leaseUpdateOne.mockImplementation(async (filter: any, update: any) => {
    const current = leases.get(filter.job);
    if (!current || current.ownerToken !== filter.ownerToken) return { matchedCount: 0 };
    if (filter.leaseUntil?.$gt && current.leaseUntil <= filter.leaseUntil.$gt) {
      return { matchedCount: 0 };
    }
    Object.assign(current, update.$set);
    return { matchedCount: 1 };
  });
});

describe('slotKeyOf', () => {
  it('identifies a firing by its UTC minute', () => {
    expect(slotKeyOf(new Date('2026-11-19T17:00:00.000Z'))).toBe('2026-11-19T17:00');
    expect(slotKeyOf(new Date('2026-11-19T17:00:59.999Z'))).toBe('2026-11-19T17:00');
    expect(slotKeyOf(new Date('2026-11-19T17:15:00.000Z'))).toBe('2026-11-19T17:15');
  });
});

describe('runExclusive', () => {
  it('lets exactly one of two replicas acquire the same job lease', async () => {
    const work = vi.fn(async () => 'done');

    const [a, b] = await Promise.all([
      runExclusive('checkInReminder', SLOT, work),
      runExclusive('checkInReminder', SLOT, work),
    ]);

    expect(work).toHaveBeenCalledTimes(1);
    expect([a.outcome, b.outcome].sort()).toEqual(['ran', 'skipped']);
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({ job: 'checkInReminder', monthKey: '2026-11-19T17:00', status: 'completed' });
    expect(leases.get('checkInReminder').leaseUntil).toEqual(new Date(0));
  });

  it('runs the next slot after releasing the previous lease', async () => {
    await runExclusive('pushReceipts', SLOT, async () => 1);
    const next = await runExclusive('pushReceipts', new Date('2026-11-19T17:15:00Z'), async () => 2);
    expect(next).toEqual({ outcome: 'ran', result: 2 });
  });

  it('keeps different jobs independent within one slot', async () => {
    const a = await runExclusive('goalReminder', SLOT, async () => 'a');
    const b = await runExclusive('checkInReminder', SLOT, async () => 'b');
    expect(a.outcome).toBe('ran');
    expect(b.outcome).toBe('ran');
  });

  it('does not overlap a live run in a later scheduled slot', async () => {
    let release!: () => void;
    const work = new Promise<string>((resolve) => {
      release = () => resolve('done');
    });
    const first = runExclusive('subscriptionSync', SLOT, () => work);
    await vi.waitFor(() => expect(ledger).toHaveLength(1));
    const second = await runExclusive(
      'subscriptionSync',
      new Date('2026-11-19T17:15:00Z'),
      async () => 'should not run'
    );
    expect(second).toEqual({ outcome: 'skipped', reason: 'still-running' });
    release();
    await first;
  });

  it('reclaims a lease after its expiration when the prior process died', async () => {
    leases.set('subscriptionSync', {
      job: 'subscriptionSync',
      ownerToken: 'abandoned',
      leaseUntil: new Date(Date.now() - 1),
      heartbeatAt: new Date(Date.now() - 60_000),
    });
    const result = await runExclusive('subscriptionSync', SLOT, async () => 'recovered');
    expect(result).toEqual({ outcome: 'ran', result: 'recovered' });
    expect(ledger[0].status).toBe('completed');
  });

  it('records a failure and rethrows it', async () => {
    await expect(
      runExclusive('goalCycleSummary', SLOT, async () => {
        throw new Error('db down');
      })
    ).rejects.toThrow('db down');
    expect(ledger[0]).toMatchObject({ status: 'failed', errorSummary: 'db down' });
  });

  it('sets an expiry so slot history does not accumulate forever', async () => {
    await runExclusive('pushReceipts', SLOT, async () => 1, { retentionMs: 1000 });
    expect(ledger[0].expiresAt.getTime() - ledger[0].startedAt.getTime()).toBe(1000);
  });

  it('propagates unexpected lease-store errors instead of silently skipping', async () => {
    leaseFindOneAndUpdate.mockRejectedValueOnce(new Error('not primary'));
    await expect(runExclusive('pushReceipts', SLOT, async () => 1)).rejects.toThrow('not primary');
  });

  it('aborts the job and records failure if heartbeat ownership is lost', async () => {
    let release!: () => void;
    let signal!: AbortSignal;
    const work = new Promise<string>((resolve) => {
      release = () => resolve('done');
    });
    const result = runExclusive(
      'pushReceipts',
      SLOT,
      (receivedSignal) => {
        signal = receivedSignal;
        return work;
      },
      { leaseMs: 30, heartbeatMs: 5 }
    );
    await vi.waitFor(() => expect(ledger).toHaveLength(1));
    leaseUpdateOne.mockResolvedValueOnce({ matchedCount: 0 });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(signal.aborted).toBe(true);
    release();
    await expect(result).rejects.toThrow('lease was lost');
    expect(ledger[0].status).toBe('failed');
  });

  it('waits for an in-flight heartbeat before releasing the lease', async () => {
    let finishHeartbeat!: (value: { matchedCount: number }) => void;
    let releaseWork!: () => void;
    leaseUpdateOne.mockImplementationOnce(
      () => new Promise((resolve) => { finishHeartbeat = resolve; })
    );

    const run = runExclusive(
      'pushReceipts',
      SLOT,
      () => new Promise<string>((resolve) => { releaseWork = () => resolve('done'); }),
      { leaseMs: 1000, heartbeatMs: 5 }
    );

    await vi.waitFor(() => expect(leaseUpdateOne).toHaveBeenCalledTimes(1));
    releaseWork();
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Final ownership check runs, but the lease release must wait for renewal.
    expect(leaseUpdateOne).toHaveBeenCalledTimes(2);
    finishHeartbeat({ matchedCount: 1 });
    await expect(run).resolves.toEqual({ outcome: 'ran', result: 'done' });
    expect(leaseUpdateOne).toHaveBeenCalledTimes(3);
    expect(leases.get('pushReceipts').leaseUntil).toEqual(new Date(0));
  });
});

describe('scheduleExclusiveJob', () => {
  it('keys the lock on the scheduled time and logs the summary', async () => {
    const work = vi.fn(async () => 'sent 3/3.');
    scheduleExclusiveJob('goalReminder', '0 10 * * *', work);

    expect(scheduled[0].expression).toBe('0 10 * * *');
    await scheduled[0].fn({ date: SLOT });
    await scheduled[0].fn({ date: SLOT });

    expect(work).toHaveBeenCalledTimes(1);
    expect(work).toHaveBeenCalledWith(SLOT, expect.anything());
    expect(ledger[0].monthKey).toBe('2026-11-19T17:00');
    expect(logger.info).toHaveBeenCalledWith('goalReminder: sent 3/3.');
  });

  it('passes cron scheduling options through', () => {
    scheduleExclusiveJob('monthlyReminder', '0 9 14 * *', async () => 'done', {}, { timezone: 'UTC' });
    expect(scheduled[0].expression).toBe('0 9 14 * *');
  });

  it('logs a failing run without crashing the process', async () => {
    scheduleExclusiveJob('goalReminder', '0 10 * * *', async () => {
      throw new Error('boom');
    });
    await expect(scheduled[0].fn({ date: SLOT })).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith('Error in goalReminder job: boom');
  });
});
