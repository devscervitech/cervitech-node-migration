import { describe, it, expect, vi, beforeEach } from 'vitest';

const axiosPost = vi.fn();
const userFind = vi.fn();
const updateMany = vi.fn();
const logSave = vi.fn();
const pushLogCtor = vi.fn();
const notifyFailure = vi.fn();

vi.mock('axios', () => ({
  default: { post: (...args: unknown[]) => axiosPost(...args) },
}));

vi.mock('../../src/services/pushAlert.service', () => ({
  notifyPushFailure: (...args: unknown[]) => notifyFailure(...args),
}));

vi.mock('../../src/models/AppUser', () => ({
  default: {
    find: (...args: unknown[]) => userFind(...args),
    updateMany: (...args: unknown[]) => updateMany(...args),
  },
}));

vi.mock('../../src/models/PushNotificationLog', () => ({
  PushNotificationLog: vi.fn(function (this: any, fields: unknown) {
    Object.assign(this, fields as object);
    this.save = logSave;
  }),
}));

import { PushNotificationDriver } from '../../src/services/pushNotificationDriver';
import { PushNotificationLog } from '../../src/models/PushNotificationLog';

beforeEach(() => {
  vi.clearAllMocks();
  axiosPost.mockReset();
  userFind.mockResolvedValue([]);
  logSave.mockResolvedValue(undefined);
});

const validToken = 'ExponentPushToken[abc]';
const pushTo = (to: string) => ({ to, title: 'T', body: 'B', data: { type: 'test_event' } });

describe('PushNotificationDriver.getReceipts', () => {
  it('chunks lookups over Expo\u2019s 1000-id limit and merges the results', async () => {
    const ids = Array.from({ length: 1500 }, (_, i) => `t${i}`);
    axiosPost
      .mockResolvedValueOnce({ data: { data: { t0: { status: 'ok' } } } })
      .mockResolvedValueOnce({ data: { data: { t1000: { status: 'ok' } } } });

    const receipts = await PushNotificationDriver.getReceipts(ids);

    expect(axiosPost).toHaveBeenCalledTimes(2);
    expect(axiosPost.mock.calls[0][0]).toBe('https://exp.host/--/api/v2/push/getReceipts');
    expect(axiosPost.mock.calls[0][1]).toEqual({ ids: ids.slice(0, 1000) });
    expect(axiosPost.mock.calls[1][1]).toEqual({ ids: ids.slice(1000) });
    expect(receipts).toEqual({ t0: { status: 'ok' }, t1000: { status: 'ok' } });
  });

  it('keeps a failing chunk\u2019s ids out of the merged receipts so they stay pending', async () => {
    const ids = Array.from({ length: 1500 }, (_, i) => `t${i}`);
    axiosPost
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce({ data: { data: { t1000: { status: 'ok' } } } });

    const receipts = await PushNotificationDriver.getReceipts(ids);

    expect(axiosPost).toHaveBeenCalledTimes(2);
    expect(receipts).toEqual({ t1000: { status: 'ok' } });
    expect(Object.keys(receipts)).toHaveLength(1);
    expect(receipts.t0).toBeUndefined();
    expect(receipts.t999).toBeUndefined();
  });
});

describe('PushNotificationDriver.sendBatch', () => {
  it('posts to Expo, records the awaited-receipt audit log, and returns the ticket id', async () => {
    axiosPost.mockResolvedValue({ data: { data: [{ status: 'ok', id: 'ticket-1' }] } });

    const result = await PushNotificationDriver.sendBatch([pushTo(validToken)]);

    expect(result.delivered).toEqual([true]);
    expect(result.ticketIds).toEqual(['ticket-1']);
    expect(axiosPost).toHaveBeenCalledTimes(1);
    expect(axiosPost.mock.calls[0][0]).toBe('https://exp.host/--/api/v2/push/send');
    expect(axiosPost.mock.calls[0][1]).toEqual([
      expect.objectContaining({ to: validToken, title: 'T', body: 'B', priority: 'high' }),
    ]);
    expect(PushNotificationLog).toHaveBeenCalledWith({
      token: validToken,
      title: 'T',
      dataType: 'test_event',
      ticketId: 'ticket-1',
      status: 'pending',
      error: undefined,
    });
    expect(logSave).toHaveBeenCalled();
  });

  it('skips non-Expo tokens without posting or logging', async () => {
    const result = await PushNotificationDriver.sendBatch([pushTo('not-an-expo-token')]);

    expect(result.delivered).toEqual([false]);
    expect(result.ticketIds).toEqual([null]);
    expect(axiosPost).not.toHaveBeenCalled();
    expect(PushNotificationLog).not.toHaveBeenCalled();
  });

  it('skips opted-out users without posting or logging, but counts them as delivered', async () => {
    userFind.mockResolvedValue([{ fcmToken: validToken }]);
    axiosPost.mockResolvedValue({ data: { data: [] } });

    const result = await PushNotificationDriver.sendBatch([pushTo(validToken)]);

    expect(result.delivered).toEqual([true]);
    expect(axiosPost).not.toHaveBeenCalled();
    expect(PushNotificationLog).not.toHaveBeenCalled();
  });

  it('clears DeviceNotRegistered tokens and logs the failure', async () => {
    axiosPost.mockResolvedValue({
      data: {
        data: [
          {
            status: 'error',
            message: 'DeviceNotRegistered',
            details: { error: 'DeviceNotRegistered' },
          },
        ],
      },
    });

    const result = await PushNotificationDriver.sendBatch([pushTo(validToken)]);

    expect(result.delivered).toEqual([false]);
    expect(result.ticketIds).toEqual([null]);
    expect(updateMany).toHaveBeenCalledWith({ fcmToken: validToken }, { $unset: { fcmToken: '' } });
    expect(PushNotificationLog).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed', error: 'DeviceNotRegistered' })
    );
    expect(logSave).toHaveBeenCalled();
  });

  it('chunks large batches at 100 messages per request', async () => {
    axiosPost.mockResolvedValue({
      data: {
        data: Array.from({ length: 100 }, (_, i) => ({ status: 'ok', id: `t${i}` })),
      },
    });
    const many = Array.from({ length: 101 }, (_, i) => pushTo(`ExponentPushToken[t${i}]`));

    const result = await PushNotificationDriver.sendBatch(many);

    expect(axiosPost).toHaveBeenCalledTimes(2);
    expect(axiosPost.mock.calls[0][1]).toHaveLength(100);
    expect(axiosPost.mock.calls[1][1]).toHaveLength(1);
    expect(result.delivered.filter(Boolean)).toHaveLength(101);
    expect(result.ticketIds.filter(Boolean)).toHaveLength(101);
  });

  it('writes a failed audit entry per message when the send request fails outright', async () => {
    axiosPost.mockRejectedValue(new Error('network down'));

    const result = await PushNotificationDriver.sendBatch([pushTo(validToken), pushTo(validToken)]);

    expect(result.delivered).toEqual([false, false]);
    expect(result.ticketIds).toEqual([null, null]);
    expect(PushNotificationLog).toHaveBeenCalledTimes(2);
    expect(PushNotificationLog).toHaveBeenCalledWith(
      expect.objectContaining({ token: validToken, status: 'failed', error: 'network down' })
    );
    expect(logSave).toHaveBeenCalledTimes(2);
  });

  it('keeps the other chunks\u2019 tickets when one chunk fails, and logs the failed chunk\u2019s messages', async () => {
    axiosPost
      .mockResolvedValueOnce({
        data: {
          data: Array.from({ length: 100 }, (_, i) => ({ status: 'ok', id: `t${i}` })),
        },
      })
      .mockRejectedValueOnce(new Error('rate limited'));
    const many = Array.from({ length: 101 }, (_, i) => pushTo(`ExponentPushToken[t${i}]`));

    const result = await PushNotificationDriver.sendBatch(many);

    expect(result.delivered.filter(Boolean)).toHaveLength(100);
    expect(result.ticketIds.filter(Boolean)).toHaveLength(100);
    expect(PushNotificationLog).toHaveBeenCalledTimes(101);
    expect(PushNotificationLog).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'pending' })
    );
    expect(PushNotificationLog).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed', error: 'rate limited' })
    );
    expect(notifyFailure).toHaveBeenCalledTimes(1);
  });

  it('raises exactly one aggregated alert for a whole batch with multiple failed chunks', async () => {
    axiosPost.mockRejectedValue(new Error('network down'));
    const many = Array.from({ length: 150 }, (_, i) => pushTo(`ExponentPushToken[t${i}]`));

    await PushNotificationDriver.sendBatch(many);

    expect(axiosPost).toHaveBeenCalledTimes(2);
    expect(notifyFailure).toHaveBeenCalledTimes(1);
    expect(notifyFailure).toHaveBeenCalledWith(expect.stringContaining('150'));
    expect(logSave).toHaveBeenCalledTimes(150);
  });

  it('does not raise an alert when every chunk is accepted', async () => {
    axiosPost.mockResolvedValue({
      data: {
        data: Array.from({ length: 100 }, (_, i) => ({ status: 'ok', id: `t${i}` })),
      },
    });
    const many = Array.from({ length: 150 }, (_, i) => pushTo(`ExponentPushToken[t${i}]`));

    await PushNotificationDriver.sendBatch(many);

    expect(notifyFailure).not.toHaveBeenCalled();
  });
});
