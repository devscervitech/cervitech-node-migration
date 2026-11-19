import axios from 'axios';
import { PushNotificationModelDTO } from '../types/pushNotificationModel.types';
import AppUser from '../models/AppUser';
import { PushNotificationLog } from '../models/PushNotificationLog';
import { notifyPushFailure } from './pushAlert.service';
import { logger } from '../utils/logger';

// The app registers devices with Expo's push service (expo-notifications'
// getExpoPushTokenAsync — tokens look like "ExponentPushToken[xxxx]"), not
// raw FCM device tokens, and Google's legacy FCM HTTP endpoint this driver
// used to call (fcm.googleapis.com/fcm/send with a server key) was shut
// down in June 2024 regardless. Sending straight to Expo's push API is
// both the correct endpoint for the tokens this app actually collects and
// the simplest one — no Firebase service-account/OAuth setup needed.
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_PUSH_RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';
const MAX_TOKENS_PER_REQUEST = 100; // Expo's own batching limit
const MAX_RECEIPT_IDS_PER_REQUEST = 1000; // Expo's own receipt lookup limit

export interface ExpoTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

export interface SendBatchResult {
  /** Per input message: true when Expo accepted the push (or the user opted out). */
  delivered: boolean[];
  /** Per input message: Expo ticket id when delivery is awaiting confirmation. */
  ticketIds: (string | null)[];
}

function isExpoPushToken(token: unknown): token is string {
  return typeof token === 'string' && token.startsWith('ExponentPushToken[');
}

export async function clearInvalidToken(token: string) {
  try {
    await AppUser.updateMany({ fcmToken: token }, { $unset: { fcmToken: '' } });
  } catch (e: any) {
    logger.error(`Failed to clear invalid push token: ${e.message}`);
  }
}

export class PushNotificationDriver {
  /** Send to a single device. Kept for the existing /fcm/test-push and
   *  /fcm/test-scheduler dev endpoints and any other single-target caller. */
  static async sendPushNotification(model: PushNotificationModelDTO): Promise<boolean> {
    const results = await PushNotificationDriver.sendBatch([model]);
    return results.delivered[0] ?? false;
  }

  /**
   * Send up to many notifications in one go, chunked to Expo's 100-per-
   * request limit. Skips users who've opted out or don't have a valid
   * Expo token, clears tokens Expo reports as no longer registered, and
   * records every accepted/failed message in PushNotificationLog so the
   * receipts polling job can confirm actual device delivery.
   */
  static async sendBatch(models: PushNotificationModelDTO[]): Promise<SendBatchResult> {
    const delivered: boolean[] = new Array(models.length).fill(false);
    const ticketIds: (string | null)[] = new Array(models.length).fill(null);

    // Resolve opt-outs once per unique token instead of once per message.
    const uniqueTokens = [...new Set(models.map((m) => m.to))];
    const optedOut = new Set(
      (
        await AppUser.find({ fcmToken: { $in: uniqueTokens }, allowPushNotifications: false })
      ).map((u) => u.fcmToken)
    );

    const sendableIndexes: number[] = [];
    const messages = models.map((model, i) => {
      if (!isExpoPushToken(model.to)) {
        logger.warn(`Skipping push: "${model.to}" is not a valid Expo push token.`);
        return null;
      }
      if (optedOut.has(model.to)) {
        delivered[i] = true; // not an error, the user just opted out
        return null;
      }
      sendableIndexes.push(i);
      return {
        to: model.to,
        sound: 'default',
        title: model.title,
        body: model.body,
        priority: 'high',
        data: model.data ?? {},
      };
    }).filter(Boolean) as any[];

    const failedChunks: { error: string; messageCount: number }[] = [];
    for (let start = 0; start < messages.length; start += MAX_TOKENS_PER_REQUEST) {
      const chunk = messages.slice(start, start + MAX_TOKENS_PER_REQUEST);
      const chunkIndexes = sendableIndexes.slice(start, start + MAX_TOKENS_PER_REQUEST);

      try {
        const response = await axios.post(EXPO_PUSH_URL, chunk, {
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        });
        const tickets: ExpoTicket[] = response.data?.data ?? [];

        for (let j = 0; j < tickets.length; j++) {
          const ticket = tickets[j];
          const modelIndex = chunkIndexes[j];
          const model = models[modelIndex];

          if (ticket.status === 'ok') {
            delivered[modelIndex] = true;
            ticketIds[modelIndex] = ticket.id ?? null;
            await logPush(model, 'pending', ticket.id, undefined);
          } else {
            const error = ticket.details?.error ?? ticket.message ?? 'Expo push error';
            logger.error(`Expo push error for token ${model.to}: ${error}`);
            await logPush(model, 'failed', undefined, error);
            if (ticket.details?.error === 'DeviceNotRegistered') {
              await clearInvalidToken(model.to);
            }
          }
        }
      } catch (error: any) {
        const message = error?.message ?? 'Expo push request failed';
        logger.error(`Expo push batch request failed: ${message}`);
        // No retry: the chunk may have been partially accepted, so re-sending
        // could double-deliver. Audit every message in the failed chunk as
        // failed instead, so the push is visible in the log and health view.
        failedChunks.push({ error: message, messageCount: chunk.length });
        for (const modelIndex of chunkIndexes) {
          await logPush(models[modelIndex], 'failed', undefined, message);
        }
      }
    }

    if (failedChunks.length > 0) {
      const totalFailed = failedChunks.reduce((sum, f) => sum + f.messageCount, 0);
      const errors = [...new Set(failedChunks.map((f) => f.error))].join('; ');
      // One aggregated alert per send batch, not one per failed chunk.
      await notifyPushFailure(
        `Push batch request failed: ${totalFailed} message(s) across ${failedChunks.length} chunk(s) (${errors})`
      );
    }

    return { delivered, ticketIds };
  }

  /** Poll delivery receipts for tickets returned by sendBatch. Distinguishes
   *  "accepted by Expo" from "actually delivered to the device". Call this
   *  ~15+ min after sendBatch with the ticket ids you want to check. Lookups
   *  over Expo's 1000-id limit are chunked into one request per chunk and the
   *  results merged; a chunk whose request fails is skipped (its entries are
   *  simply not in the merged map) without losing the other chunks' receipts. */
  static async getReceipts(ticketIds: string[]): Promise<Record<string, ExpoTicket>> {
    const receipts: Record<string, ExpoTicket> = {};
    for (let start = 0; start < ticketIds.length; start += MAX_RECEIPT_IDS_PER_REQUEST) {
      const chunk = ticketIds.slice(start, start + MAX_RECEIPT_IDS_PER_REQUEST);
      try {
        const response = await axios.post(
          EXPO_PUSH_RECEIPTS_URL,
          { ids: chunk },
          { headers: { 'Content-Type': 'application/json', Accept: 'application/json' } }
        );
        Object.assign(receipts, response.data?.data ?? {});
      } catch (error: any) {
        logger.error(
          `Failed to fetch Expo push receipts: ${error?.message ?? 'unknown error'}`
        );
      }
    }
    return receipts;
  }
}

async function logPush(
  model: PushNotificationModelDTO,
  status: 'pending' | 'failed',
  ticketId: string | undefined,
  error: string | undefined
): Promise<void> {
  try {
    const log = new PushNotificationLog({
      token: model.to,
      title: model.title,
      dataType: model.data?.type as string | undefined,
      ticketId,
      status,
      error,
    });
    await log.save();
  } catch (e: any) {
    logger.error(`Failed to write push audit log: ${e.message}`);
  }
}