import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';

const ApiResponseStatus = {
  BadRequest: 'BadRequest',
  Unauthorized: 'Unauthorized',
  Successful: 'Successful',
  Failed: 'Failed',
  UnknownError: 'UnknownError',
};

function getApiResponseMessages() {
  return {
    [ApiResponseStatus.BadRequest]: 400,
    [ApiResponseStatus.Unauthorized]: 401,
    [ApiResponseStatus.Successful]: 200,
    [ApiResponseStatus.Failed]: 500,
    [ApiResponseStatus.UnknownError]: 500,
  };
}

export interface DataResult<T = any> {
  StatusCode: number;
  Message: string;
  Data: T | string;
}

function sendSuccess<T>(
  res: Response,
  data: T,
  message = 'Successful',
  statusCode: number = getApiResponseMessages()[ApiResponseStatus.Successful]
) {
  return res.status(statusCode).json({ success: true, message, data });
}

function sendError(res: Response, statusCode: number, message: string, error?: string) {
  return res.status(statusCode).json({ success: false, message, ...(error ? { error } : {}) });
}

function requireAuthenticatedUserId(
  req: AuthenticatedRequest,
  res: Response
): string | undefined {
  const userId = req.user?.userId;
  if (!userId) {
    sendError(
      res,
      getApiResponseMessages()[ApiResponseStatus.Unauthorized],
      'Unauthorized. Please log in.'
    );
    return undefined;
  }
  return userId;
}

export {
  getApiResponseMessages,
  ApiResponseStatus,
  sendSuccess,
  sendError,
  requireAuthenticatedUserId,
};
