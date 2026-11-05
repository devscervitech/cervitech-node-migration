const { getApiResponseMessages, ApiResponseStatus } = require('../utils/apiResponse');
const appUserService = require('../services/appUserService');
const logger = require('../utils/logger');
export const updateFCMToken = async (req, res) => {
    const updateViewModel = req.body;
    logger.info(`FCMTokenUpdateViewModel: ${JSON.stringify(updateViewModel)}`);
    const responses = getApiResponseMessages();
    try {
        if (!updateViewModel ||
            typeof updateViewModel.fcmToken !== 'string' ||
            typeof updateViewModel.userId !== 'number') {
            res.status(400).json({
                statusCode: responses[ApiResponseStatus.BadRequest],
                message: ApiResponseStatus.BadRequest,
                data: null,
            });
            return;
        }
        try {
            const data = await appUserService.updateFCMTokenAsync(updateViewModel);
            res.status(200).json({
                statusCode: responses[ApiResponseStatus.Successful],
                message: ApiResponseStatus.Successful,
                data,
            });
        }
        catch (ex) {
            const error = ex instanceof Error ? ex : new Error('Custom error');
            logger.error(error.message);
            res.status(500).json({
                statusCode: responses[ApiResponseStatus.Failed],
                message: error.message,
                data: null,
            });
        }
    }
    catch (ex) {
        const error = ex instanceof Error ? ex : new Error('Unexpected error');
        logger.error(error.message);
        res.status(500).json({
            statusCode: responses[ApiResponseStatus.UnknownError],
            message: ApiResponseStatus.UnknownError,
            exceptionErrorMessage: error.message,
            data: null,
        });
    }
};
