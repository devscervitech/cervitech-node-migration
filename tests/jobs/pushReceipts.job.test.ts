import { describe, it, expect, vi, beforeEach } from 'vitest';

const find = vi.fn();
const bulkWrite = vi.fn();
const getReceipts = vi.fn();
const clearInvalidTokens = vi.fn();
const notifyPushFailure = vi.fn();
const cursors: any[] = [];

vi.mock('../../src/models/PushNotificationLog', () => ({
  PushNotificationLog: {
    find: (...args: unknown[]) => find(...args),
    bulkWrite: (...args: unknown[]) => bulkWrite(...args),
  },
}));
vi.mock('../../src/services/pushNotificationDriver', () => ({
  PushNotificationDriver: { getReceipts: (...args: unknown[]) => getReceipts(...args) },
  clearInvalidTokens: (...args: unknown[]) => clearInvalidTokens(...args),
}));
vi.mock('../../src/services/pushAlert.service', () => ({
  notifyPushFailure: (...args: unknown[]) => notifyPushFailure(...args),
}));
vi.mock('../../src/jobs/jobLock', () => ({ scheduleExclusiveJob: vi.fn() }));

import { runPushReceiptPolling, RECEIPT_BATCH_SIZE } from '../../src/jobs/pushReceipts.job';

const NOW = new Date('2026-11-19T17:00:00Z');
const log = (id: number, extra: Record<string, unknown> = {}) => ({
  _id: `log-${id}`,
  ticketId: `ticket-${id}`,
  token: `ExponentPushToken[${id}]`,
  title: `title-${id}`,
  dataType: 'test',
  ...extra,
});
const makeCursor = (items: any[]) => {
  const cursor = {
    async *[Symbol.asyncIterator]() {
      for (const item of items) yield item;
    },
    close: vi.fn(async () => undefined),
  };
  cursors.push(cursor);
  return cursor;
};

beforeEach(() => {
  vi.clearAllMocks();
  cursors.length = 0;
  const expired: any[] = [];
  const pending: any[] = [];
  find.mockImplementation((filter: any) => {
    const query: any = {
      select: () => query,
      cursor: (options: unknown) => {
        query.cursorOptions = options;
        return makeCursor(filter.sentAt.$gt ? pending : expired);
      },
    };
    return query;
  });
  (find as any).setResults = (expiredItems: any[], pendingItems: any[]) => {
    expired.splice(0, expired.length, ...expiredItems);
    pending.splice(0, pending.length, ...pendingItems);
  };
  bulkWrite.mockResolvedValue({});
  getReceipts.mockResolvedValue({});
  clearInvalidTokens.mockResolvedValue(undefined);
  notifyPushFailure.mockResolvedValue(undefined);
});

describe('runPushReceiptPolling', () => {
  it('streams expired and pending logs in bounded cursors and closes both cursors', async () => {
    (find as any).setResults(
      [log(1), log(2)],
      [log(3), log(4, { ticketId: '' })]
    );

    const evaluated = await runPushReceiptPolling(NOW);

    expect(evaluated).toBe(4);
    expect(find).toHaveBeenCalledTimes(2);
    expect(cursors).toHaveLength(2);
    expect(cursors.every((cursor) => cursor.close.mock.calls.length === 1)).toBe(true);
    expect(bulkWrite).toHaveBeenCalledTimes(1); // expired entries only
    expect(bulkWrite.mock.calls[0][0]).toHaveLength(2);
    expect(getReceipts).toHaveBeenCalledWith(['ticket-3']);
    expect(notifyPushFailure).toHaveBeenCalledWith(
      expect.stringContaining('2 push(es) abandoned (receipt window expired)')
    );
  });

  it('updates delivery/error states in bulk and clears invalid tokens once', async () => {
    (find as any).setResults([], [log(1), log(2), log(3)]);
    getReceipts.mockResolvedValue({
      'ticket-1': { status: 'ok' },
      'ticket-2': { status: 'error', details: { error: 'DeviceNotRegistered' } },
    });

    expect(await runPushReceiptPolling(NOW)).toBe(3);
    expect(bulkWrite).toHaveBeenCalledTimes(1);
    expect(bulkWrite.mock.calls[0][0]).toEqual([
      {
        updateOne: {
          filter: { _id: 'log-1', status: 'pending' },
          update: { $set: { status: 'delivered', deliveredAt: NOW } },
        },
      },
      {
        updateOne: {
          filter: { _id: 'log-2', status: 'pending' },
          update: { $set: { status: 'failed', error: 'DeviceNotRegistered' } },
        },
      },
    ]);
    expect(clearInvalidTokens).toHaveBeenCalledWith(['ExponentPushToken[2]']);
    expect(notifyPushFailure).toHaveBeenCalledWith(expect.stringContaining('1 push(es) not delivered'));
  });

  it('splits a large pending scan into Expo-sized bounded batches', async () => {
    const pending = Array.from({ length: RECEIPT_BATCH_SIZE + 1 }, (_, index) => log(index));
    (find as any).setResults([], pending);

    expect(await runPushReceiptPolling(NOW)).toBe(pending.length);
    expect(getReceipts).toHaveBeenCalledTimes(2);
    expect(getReceipts.mock.calls.map((call) => call[0].length)).toEqual([RECEIPT_BATCH_SIZE, 1]);
  });

  it('aborts before polling the next batch when the lease is lost', async () => {
    const controller = new AbortController();
    const abortingCursor = {
      async *[Symbol.asyncIterator]() {
        yield log(1);
        controller.abort(new Error('lease lost'));
        yield log(2);
      },
      close: vi.fn(async () => undefined),
    };
    find.mockImplementationOnce(() => ({ select: () => ({ cursor: () => makeCursor([]) }) }));
    find.mockImplementationOnce(() => ({ select: () => ({ cursor: () => abortingCursor }) }));
    await expect(runPushReceiptPolling(NOW, controller.signal)).rejects.toThrow('lease lost');
    expect(getReceipts).not.toHaveBeenCalled();
    expect(abortingCursor.close).toHaveBeenCalled();
  });
});
