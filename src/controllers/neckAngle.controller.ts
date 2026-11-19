// user.controller.ts
import { Request, Response } from 'express';
import { getApiResponseMessages, ApiResponseStatus } from '../utils/apiResponse';
import { NeckAngleService } from '../services/appUserServices/neckAngle.service';
import { logger } from '../utils/logger';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { NeckAngleModel } from '../models/NeckAngle';
import { JobScheduler } from '../services/JobScheduler';

export class NeckAngleController {
  static async postBatchNeckAngleRecords(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user?.userId || req.user.role !== 'APP_USER') {
      res.status(req.user ? 403 : 401).json({ error: 'Unauthorized' });
      return;
    }
    const model: NeckAngleModel = { ...req.body, appUserId: req.user.userId };

    if (
      !model ||
      typeof model.appUserId !== 'string' ||
      !Array.isArray(model.neckAngleRecords) ||
      model.neckAngleRecords.length === 0
    ) {
      res.status(400).json({
        statusCode: 400,
        message: 'BadRequest',
        data: null,
      });
      return;
    }

    try {
      const data = await NeckAngleService.postBatchNeckAngleRecordAsync(model);
      res.status(200).json({
        statusCode: 200,
        message: 'Successful',
        data,
      });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error('Custom exception');
      logger.error(err.message);

      res.status(500).json({
        statusCode: 500,
        message: err.message,
        data: null,
      });
    }
  }

  static async getWeeklyNeckAngleAverages(req: Request, res: Response) {
    try {
      const records = req.body.records.map(
        (r: { dateTimeRecorded: string; [key: string]: any }) => ({
          ...r,
          dateTimeRecorded: new Date(r.dateTimeRecorded),
        })
      );
      if (!Array.isArray(records)) {
        return res.status(400).json({ error: 'records must be an array' });
      }
      console.log('records received:', records);
      const result = await NeckAngleService.getEachWeekOfTheMonthAverageNeckAngle(records);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // static async sendPushNotificationMessageForAverageNeckAngle(req: Request, res: Response): Promise<void> {
  //   const responses = getApiResponseMessages();

  //   try {
  //     // Circle back to this later
  //     const data = await NeckAngleService.sendPushNotificationMessageForAverageNeckAngle();
  //     res.status(200).json({
  //       statusCode: responses[ApiResponseStatus.Successful],
  //       message: ApiResponseStatus.Successful,
  //       data,
  //     });
  //   } catch (error: unknown) {
  //     const err = error instanceof Error ? error : new Error('Custom error');
  //     logger.error(err.message);

  //     res.status(500).json({
  //       statusCode: responses[ApiResponseStatus.Failed],
  //       message: err.message,
  //       data: null,
  //     });
  //   }
  // }

  static async resetNotificationCount(req: AuthenticatedRequest, res: Response) {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      await JobScheduler.resetNotificationCount(userId);
      res.status(200).json({
        statusCode: 200,
        message: 'Notification count reset successfully',
        data: true,
      });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error('Custom error');
      logger.error(err.message);

      res.status(500).json({
        statusCode: 500,
        message: err.message,
        data: null,
      });
    }
  }

  static async getCurrentDayAverageNeckAngleTextReport(req: Request, res: Response): Promise<void> {
    const { neckAngle } = req.query;

    if (!neckAngle || isNaN(Number(neckAngle))) {
      res.status(400).json({
        statusCode: 400,
        message: 'Valid neck angle is required',
        data: null,
      });
      return;
    }

    try {
      const { Utils } = await import('../utils/utils');
      const report = Utils.currentDayAverageNeckAngleTextReport(Number(neckAngle));

      res.status(200).json({
        statusCode: 200,
        message: 'Text report generated successfully',
        data: {
          neckAngle: Number(neckAngle),
          report: report,
        },
      });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error('Custom error');
      logger.error(err.message);

      res.status(500).json({
        statusCode: 500,
        message: err.message,
        data: null,
      });
    }
  }

  static async getWeeklyChartData(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

      const data = await NeckAngleService.getWeeklyChartData(userId);
      return res.status(200).json({ success: true, message: 'Successful', data });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  static async getUserNeckAngleStatistics(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

      const data = await NeckAngleService.computeNeckAngleParameters(userId);
      return res.status(200).json({ success: true, message: 'Successful', data });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }
}