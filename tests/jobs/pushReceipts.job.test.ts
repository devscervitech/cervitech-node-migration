import { describe, it, expect, vi, beforeEach } from 'vitest';

const logFind = vi.fn();
const getReceipts = vi.fn();
const clearToken = vi.fn();
const notifyFailure = vi.fn();

vi.mock('../../src/models/PushNotificationLog', () => ({
  PushNotificationLog: { find: (...args: unknown[]) => logFind(...args) },
}));

vi.mock('../../src/services/pushNotificationDriver', () => ({
  PushNotificationDriver: { getReceipts: (...args: unknown[]) => getReceipts(...args) },
  clearInvalidToken: (...args: unknown[]) => clearToken(...args),
}));

vi.mock('../../src/services/pushAlert.service', () => ({
  notifyPushFailure: (...args: unknown[]) => notifyFailure(...args),
}));

import { runPushReceiptPolling } from '../../src/jobs/pushReceipts.job';

const NOW = new Date('2026-08-14T12:00:00Z');
const pendingLog = (ticketId: string, extra: object = {}) => {
  const log = {
    _id: ticketId,
    token: 'ExponentPushToken[abc]',
    title: 'Goal reminder',
    dataType: 'goal_reminder',
    ticketId,
    status: 'pending',
    deliveredAt: undefined as Date | undefined,
    error: undefined as string | undefined,
    save: vi.fn().mockResolvedValue(undefined),
    ...extra,
  };
  return log;
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('runPushReceiptPolling', () => {
  it('marks pending logs as delivered when Expo confirms delivery', async () => {
    const log = pendingLog('t1');
    logFind.mockResolvedValueOnce([]).mockResolvedValueOnce([log]);
    getReceipts.mockResolvedValue({ t1: { status: 'ok', id: 't1' } });

    const processed = await runPushReceiptPolling(NOW);

    expect(processed).toBe(1);
    expect(log.status).toBe('delivered');
    expect(log.deliveredAt).toEqual(NOW);
    expect(log.save).toHaveBeenCalled();
    expect(notifyFailure).not.toHaveBeenCalled();
  });

  it('marks DeviceNotRegistered as failed, clears the token, and raises an alert', async () => {
    const log = pendingLog('t1');
    logFind.mockResolvedValueOnce([]).mockResolvedValueOnce([log]);
    getReceipts.mockResolvedValue({
      t1: {
        status: 'error',
        message: 'DeviceNotRegistered',
        details: { error: 'DeviceNotRegistered' },
      },
    });

    const processed = await runPushReceiptPolling(NOW);

    expect(processed).toBe(1);
    expect(log.status).toBe('failed');
    expect(log.error).toBe('DeviceNotRegistered');
    expect(clearToken).toHaveBeenCalledWith('ExponentPushToken[abc]');
    expect(notifyFailure).toHaveBeenCalledWith(expect.stringContaining('1 push(es) not delivered'));
  });

  it('keeps logs awaiting Expo confirmation untouched', async () => {
    const log = pendingLog('t1');
    logFind.mockResolvedValueOnce([]).mockResolvedValueOnce([log]);
    getReceipts.mockResolvedValue({});

    const processed = await runPushReceiptPolling(NOW);

    expect(processed).toBe(1);
    expect(log.status).toBe('pending');
    expect(log.save).not.toHaveBeenCalled();
    expect(notifyFailure).not.toHaveBeenCalled();
  });

  it('does nothing when there are no pending logs', async () => {
    logFind.mockResolvedValue([]);

    const processed = await runPushReceiptPolling(NOW);

    expect(processed).toBe(0);
    expect(getReceipts).not.toHaveBeenCalled();
  });

  it('only polls logs older than the receipts grace period but younger than the 24h window', async () => {
    logFind.mockResolvedValue([]);

    await runPushReceiptPolling(NOW);

    expect(logFind).toHaveBeenCalledWith({
      status: 'pending',
      ticketId: { $exists: true },
      sentAt: { $lte: expect.any(Date) },
    });
    expect(logFind).toHaveBeenCalledWith({
      status: 'pending',
      ticketId: { $exists: true },
      sentAt: { $gt: expect.any(Date), $lte: expect.any(Date) },
    });
  });

  it('closes pending entries past Expo\u2019s 24h window as failed without polling them', async () => {
    const expiredLog = pendingLog('old-ticket');
    logFind.mockResolvedValueOnce([expiredLog]).mockResolvedValueOnce([]);

    const processed = await runPushReceiptPolling(NOW);

    expect(processed).toBe(1);
    expect(expiredLog.status).toBe('failed');
    expect(expiredLog.error).toBe('receipt window expired');
    expect(expiredLog.save).toHaveBeenCalled();
    expect(getReceipts).not.toHaveBeenCalled();
    expect(notifyFailure).toHaveBeenCalledWith(expect.stringContaining('receipt window expired'));
  });

  it('counts expired windows in the same alert as confirmed failures', async () => {
    const expiredLog = pendingLog('old-ticket');
    const failedLog = pendingLog('t1');
    logFind.mockResolvedValueOnce([expiredLog]).mockResolvedValueOnce([failedLog]);
    getReceipts.mockResolvedValue({
      t1: { status: 'error', message: 'MessageTooBig', details: { error: 'MessageTooBig' } },
    });

    await runPushReceiptPolling(NOW);

    expect(notifyFailure).toHaveBeenCalledTimes(1);
    expect(notifyFailure).toHaveBeenCalledWith(expect.stringContaining('MessageTooBig'));
    expect(notifyFailure).toHaveBeenCalledWith(
      expect.stringContaining('receipt window expired')
    );
    expect(getReceipts).toHaveBeenCalledWith(['t1']);
  });
});
