// user.controller.ts
import { Request, Response } from 'express';
const { getApiResponseMessages, ApiResponseStatus } = require('../utils/apiResponse');
const appUserService = require('../services/appUserService');
const logger = require('../utils/logger');

export const sendPasswordResetToken = async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body;
  logger.info(`Email: ${email}`);

  const responses = getApiResponseMessages();

  try {
    if (!email || typeof email !== 'string') {
      res.status(400).json({
        statusCode: responses[ApiResponseStatus.BadRequest],
        message: ApiResponseStatus.BadRequest,
        data: null,
      });
      return;
    }

    try {
      const data = await appUserService.sendPasswordResetTokenAsync(email);
      res.status(200).json({
        statusCode: responses[ApiResponseStatus.Successful],
        message: ApiResponseStatus.Successful,
        data,
      });
    } catch (ex: unknown) {
      const error = ex instanceof Error ? ex : new Error('Unknown error');
      logger.error(error.message);

      res.status(500).json({
        statusCode: responses[ApiResponseStatus.Failed],
        message: error.message,
        data: null,
      });
    }
  } catch (ex: unknown) {
    const error = ex instanceof Error ? ex : new Error('Unknown error');
    logger.error(error.message);

    res.status(500).json({
      statusCode: responses[ApiResponseStatus.UnknownError],
      message: ApiResponseStatus.UnknownError,
      exceptionErrorMessage: error.message,
      data: null,
    });
  }
};

export const getNeckAngleParameters = async (req: Request, res: Response) => {
  const id = parseInt(req.query.id as string, 10);
  logger.info(`Received ID: ${id}`);

  const responses = getApiResponseMessages();

  try {
    // Basic validation
    if (isNaN(id)) {
      return res.status(400).json({
        statusCode: responses[ApiResponseStatus.BadRequest],
        message: ApiResponseStatus.BadRequest,
        data: null,
      });
    }

    try {
      const data = await appUserService.computeNeckAngleParametersAsync(id);
      return res.status(200).json({
        statusCode: responses[ApiResponseStatus.Successful],
        message: ApiResponseStatus.Successful,
        data,
      });
    } catch (error: any) {
      logger.error(error.message);
      return res.status(500).json({
        statusCode: responses[ApiResponseStatus.Failed],
        message: error.message,
        data: null,
      });
    }
  } catch (error: any) {
    logger.error(error.message);
    return res.status(500).json({
      statusCode: responses[ApiResponseStatus.UnknownError],
      message: ApiResponseStatus.UnknownError,
      exceptionErrorMessage: error.message,
      data: null,
    });
  }
};