import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const axiosPost = vi.fn();
const logError = vi.fn();

vi.mock('axios', () => ({ default: { post: (...args: unknown[]) => axiosPost(...args) } }));
vi.mock('../../src/utils/logger', () => ({
  logger: { error: (...args: unknown[]) => logError(...args) },
}));

import { notifyPushFailure } from '../../src/services/pushAlert.service';

const realWebhook = process.env.PUSH_ALERT_SLACK_WEBHOOK_URL;

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  if (realWebhook === undefined) delete process.env.PUSH_ALERT_SLACK_WEBHOOK_URL;
  else process.env.PUSH_ALERT_SLACK_WEBHOOK_URL = realWebhook;
  vi.unstubAllEnvs();
});

describe('notifyPushFailure', () => {
  it('log-only fallback when no Slack webhook is configured', async () => {
    delete process.env.PUSH_ALERT_SLACK_WEBHOOK_URL;

    await notifyPushFailure('18 push receipts failed');

    expect(axiosPost).not.toHaveBeenCalled();
    expect(logError).toHaveBeenCalledWith(expect.stringContaining('18 push receipts failed'));
  });

  it('posts to the Slack webhook when configured, and still logs', async () => {
    process.env.PUSH_ALERT_SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/xxx';
    axiosPost.mockResolvedValue({ status: 200 });

    await notifyPushFailure('goal reminder job failed');

    expect(axiosPost).toHaveBeenCalledWith('https://hooks.slack.com/services/xxx', {
      text: expect.stringContaining('goal reminder job failed'),
    });
    expect(logError).toHaveBeenCalled();
  });

  it('never throws when the webhook itself fails', async () => {
    process.env.PUSH_ALERT_SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/xxx';
    axiosPost.mockRejectedValue(new Error('network down'));

    await expect(notifyPushFailure('boom')).resolves.toBeUndefined();
    expect(logError).toHaveBeenCalledWith(expect.stringContaining('network down'));
  });
});
