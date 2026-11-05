// user.controller.ts
import { Request, Response } from 'express';
import { AutomatePostNeckAngleRecordsViewModel } from '../viewmodels/AutomatePostNeckAngleRecords';
import { getApiResponseMessages, ApiResponseStatus } from '../utils/apiResponse';
import { NeckAngleService } from '../services/neckAngle.service';
import { logger } from '../utils/logger';
import { NeckAngleModel } from '../models/neckAngle';

export class NeckAngleController {
  static async postBatchNeckAngleRecords(req: Request, res: Response): Promise<void> {
    const model: NeckAngleModel = req.body;
    logger.info(`NeckAngleModel: ${JSON.stringify(model)}`);

    const responses = getApiResponseMessages();

    if (
      !model ||
      typeof model.appUserId !== 'number' ||
      !Array.isArray(model.neckAngleRecords) ||
      model.neckAngleRecords.length === 0
    ) {
      res.status(400).json({
        statusCode: responses[ApiResponseStatus.BadRequest],
        message: ApiResponseStatus.BadRequest,
        data: null,
      });
      return;
    }

    try {
      const data = await NeckAngleService.postBatchNeckAngleRecordAsync(model);
      res.status(200).json({
        statusCode: responses[ApiResponseStatus.Successful],
        message: ApiResponseStatus.Successful,
        data,
      });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error('Custom exception');
      logger.error(err.message);

      res.status(500).json({
        statusCode: responses[ApiResponseStatus.Failed],
        message: err.message,
        data: null,
      });
    }
  }

  static async postRandomTestBatchNeckAngleRecords(req: Request, res: Response): Promise<void> {
    const model: AutomatePostNeckAngleRecordsViewModel = req.body;
    logger.info(`AutomatePostNeckAngleRecordsViewModel: ${JSON.stringify(model)}`);

    const responses = getApiResponseMessages();

    if (
      !model ||
      typeof model.appUserId !== 'string' ||
      !Array.isArray(model.testValues)
    ) {
      res.status(400).json({
        statusCode: responses[ApiResponseStatus.BadRequest],
        message: ApiResponseStatus.BadRequest,
        data: null,
      });
      return;
    }

    try {
      const data = await NeckAngleService.postRandomBatchNeckAngleRecordForTestAsync(model);
      res.status(200).json({
        statusCode: responses[ApiResponseStatus.Successful],
        message: ApiResponseStatus.Successful,
        data,
      });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error('Custom error');
      logger.error(err.message);

      res.status(500).json({
        statusCode: responses[ApiResponseStatus.Failed],
        message: err.message,
        data: null,
      });
    }
  }
}


