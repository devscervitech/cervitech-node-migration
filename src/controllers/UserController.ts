
import { Request, Response } from "express";
import { PictureUrlUpdateViewModel } from "../viewmodels/PictureUrlUpdateViewModel";
import { AppUserService } from "../services/appUserService.service";
import { GetApiResponseMessages, ApiResponseStatus } from "../helpers/ApiResponse";
import { DataResult } from "../helpers/DataResult";

const UserController = {
  async updatePictureUrl(req: Request, res: Response): Promise<void> {
    const responses = GetApiResponseMessages();
    const updateViewModel: PictureUrlUpdateViewModel = req.body;

    console.log("UpdatePictureUrl input:", updateViewModel);

    let dataResult: DataResult;

    try {
      if (!updateViewModel.userId || !updateViewModel.pictureUrl) {
        dataResult = {
          statusCode: responses[ApiResponseStatus.BadRequest],
          message: ApiResponseStatus.BadRequest,
          data: null
        };
        res.status(dataResult.statusCode).json(dataResult);
        return
      }

      try {
        const result = await AppUserService.updatePictureUrlAsync(updateViewModel);
        dataResult = {
          statusCode: responses[ApiResponseStatus.Successful],
          message: ApiResponseStatus.Successful,
          data: result
        };
      } catch (customError: any) {
        console.error("CustomException:", customError.message);
        dataResult = {
          statusCode: responses[ApiResponseStatus.Failed],
          message: customError.message,
          data: null
        };
      }
    } catch (error: any) {
      console.error("Exception:", error.message);
      dataResult = {
        statusCode: responses[ApiResponseStatus.UnknownError],
        message: ApiResponseStatus.UnknownError,
        exceptionErrorMessage: error.message,
        data: null
      };
    }

    res.status(dataResult.statusCode).json(dataResult);
    return;
  },
  async updateSubscription(req: Request, res: Response): Promise<void> {
    const responses = GetApiResponseMessages();
    // const id = parseInt(req.params.id);
    const id = req.params.id;

    console.log("UpdateSubscription input ID:", id);

    let dataResult: DataResult;

    try {
      // if (!id || isNaN(id)) {
      //   dataResult = {
      //     statusCode: responses[ApiResponseStatus.BadRequest],
      //     message: ApiResponseStatus.BadRequest,
      //     data: null
      //   };
      //   res.status(dataResult.statusCode).json(dataResult);
      //   return
      // }

      try {
        const result = await AppUserService.updateSubscriptionAsync(id);

        dataResult = {
          statusCode: responses[ApiResponseStatus.Successful],
          message: ApiResponseStatus.Successful,
          data: result
        };
      } catch (customError: any) {
        console.error("CustomException:", customError.message);

        dataResult = {
          statusCode: responses[ApiResponseStatus.Failed],
          message: customError.message,
          data: null
        };
      }
    } catch (error: any) {
      console.error("Unhandled Exception:", error.message);

      dataResult = {
        statusCode: responses[ApiResponseStatus.UnknownError],
        message: ApiResponseStatus.UnknownError,
        exceptionErrorMessage: error.message,
        data: null
      };
    }

    res.status(dataResult.statusCode).json(dataResult);
    return
  }
}

export const getResponseRate = async (req: Request, res: Response) => {
  const responses = GetApiResponseMessages();

  const id = req.query.id as string;
  const dateStr = req.query.date as string;

  let dataResult: DataResult;

  try {
    // Validate input
    if (!id || !dateStr || isNaN(Date.parse(dateStr))) {
      dataResult = {
        statusCode: responses[ApiResponseStatus.BadRequest],
        message: ApiResponseStatus.BadRequest,
        data: null
      };
      return res.status(dataResult.statusCode).json(dataResult);
    }

    try {
      const date = new Date(dateStr);
      const result = await AppUserService.getResponseRateAsync(id, date);

      dataResult = {
        statusCode: responses[ApiResponseStatus.Successful],
        message: ApiResponseStatus.Successful,
        data: result
      };
    } catch (customError: any) {
      console.error("CustomException:", customError.message);
      dataResult = {
        statusCode: responses[ApiResponseStatus.Failed],
        message: customError.message,
        data: null
      };
    }
  } catch (error: any) {
    console.error("Unhandled Exception:", error.message);
    dataResult = {
      statusCode: responses[ApiResponseStatus.UnknownError],
      message: ApiResponseStatus.UnknownError,
      exceptionErrorMessage: error.message,
      data: null
    };
  }

  return res.status(dataResult.statusCode).json(dataResult);
};

export default UserController;
