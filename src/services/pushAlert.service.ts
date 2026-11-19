import axios from 'axios';
import { logger } from '../utils/logger';

/**
 * Elevate a push-notification problem to whoever is on call. If
 * PUSH_ALERT_SLACK_WEBHOOK_URL is configured the message goes to that Slack
 * channel; otherwise it falls back to the error log. Never throws.
 */
export async function notifyPushFailure(message: string): Promise<void> {
  const webhookUrl = process.env.PUSH_ALERT_SLACK_WEBHOOK_URL;
  if (webhookUrl && webhookUrl.trim()) {
    try {
      await axios.post(webhookUrl, { text: `[push] ${message}` });
    } catch (error: any) {
      logger.error(`Push alert webhook failed: ${error.message}`);
    }
  }
  logger.error(`[push-alert] ${message}`);
}
