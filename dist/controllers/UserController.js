import { AppUserService } from "../services/appUserService.service";
import { GetApiResponseMessages, ApiResponseStatus } from "../helpers/ApiResponse";
const UserController = {
    async updatePictureUrl(req, res) {
        const responses = GetApiResponseMessages();
        const updateViewModel = req.body;
        console.log("UpdatePictureUrl input:", updateViewModel);
        let dataResult;
        try {
            if (!updateViewModel.userId || !updateViewModel.pictureUrl) {
                dataResult = {
                    statusCode: responses[ApiResponseStatus.BadRequest],
                    message: ApiResponseStatus.BadRequest,
                    data: null
                };
                res.status(dataResult.statusCode).json(dataResult);
                return;
            }
            try {
                const result = await AppUserService.updatePictureUrlAsync(updateViewModel);
                dataResult = {
                    statusCode: responses[ApiResponseStatus.Successful],
                    message: ApiResponseStatus.Successful,
                    data: result
                };
            }
            catch (customError) {
                console.error("CustomException:", customError.message);
                dataResult = {
                    statusCode: responses[ApiResponseStatus.Failed],
                    message: customError.message,
                    data: null
                };
            }
        }
        catch (error) {
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
    async updateSubscription(req, res) {
        const responses = GetApiResponseMessages();
        // const id = parseInt(req.params.id);
        const id = req.params.id;
        console.log("UpdateSubscription input ID:", id);
        let dataResult;
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
            }
            catch (customError) {
                console.error("CustomException:", customError.message);
                dataResult = {
                    statusCode: responses[ApiResponseStatus.Failed],
                    message: customError.message,
                    data: null
                };
            }
        }
        catch (error) {
            console.error("Unhandled Exception:", error.message);
            dataResult = {
                statusCode: responses[ApiResponseStatus.UnknownError],
                message: ApiResponseStatus.UnknownError,
                exceptionErrorMessage: error.message,
                data: null
            };
        }
        res.status(dataResult.statusCode).json(dataResult);
        return;
    }
};
export const getResponseRate = async (req, res) => {
    const responses = GetApiResponseMessages();
    const id = req.query.id;
    const dateStr = req.query.date;
    let dataResult;
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
        }
        catch (customError) {
            console.error("CustomException:", customError.message);
            dataResult = {
                statusCode: responses[ApiResponseStatus.Failed],
                message: customError.message,
                data: null
            };
        }
    }
    catch (error) {
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
