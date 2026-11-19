// fcm.controller.ts
import { Request, Response } from 'express';
// import {FCMTokenUpdateViewModel} from "../viewmodels/FCMTokenUpdateViewModel";
import { getApiResponseMessages, ApiResponseStatus } from '../utils/apiResponse';
import { logger } from '../utils/logger';
import { PushNotificationDriver } from '../services/pushNotificationDriver';
import { PushNotificationModelDTO } from '../types/pushNotificationModel.types';
import { JobScheduler } from '../services/JobScheduler';



export class FCMController {
  static async testPush(req: Request, res: Response): Promise<void> {
    const token = req.query.token as string | undefined;

    if (!token) {
      res.status(400).json({ error: 'FCM token is required (query param: token).' });
      return;
    }

    try {
      const model: PushNotificationModelDTO = {
        to: token,
        title: 'Test Push',
        body: 'Test push notification',
      };
      await PushNotificationDriver.sendPushNotification(model);
      res.status(200).json({ message: 'Push notification sent' });
    } catch (error) {
      logger.error(
        'Error sending test push:',
        error instanceof Error ? error.message : String(error)
      );
      res.status(500).json({ error: 'Failed to send push notification' });
    }
  }

  static async testScheduler(req: Request, res: Response): Promise<void> {
    const token = req.query.token as string | undefined;
    const cron = (req.query.cron as string) || '* * * * *';

    if (!token) {
      res.status(400).json({ error: 'FCM token is required (query param: token).' });
      return;
    }

    try {
      const jobId = `test-push-${token}`;
      const title = 'Test Scheduler';
      const body = 'Scheduled test push notification';
      JobScheduler.addJob(jobId, cron, async () => {
        await PushNotificationDriver.sendPushNotification({ to: token, title, body });
      });
      res.status(200).json({ message: 'Scheduler started', cron, jobId });
    } catch (error) {
      logger.error(
        'Error starting scheduler:',
        error instanceof Error ? error.message : String(error)
      );
      res.status(500).json({ error: 'Failed to start scheduler' });
    }
  }

  static async stopScheduler(_req: Request, res: Response): Promise<void> {
    try {
      JobScheduler.removeAllJobs();
      res.status(200).json({ message: 'All test schedulers stopped' });
    } catch (error) {
      logger.error(
        'Error stopping scheduler:',
        error instanceof Error ? error.message : String(error)
      );
      res.status(500).json({ error: 'Failed to stop scheduler' });
    }
  }
}
