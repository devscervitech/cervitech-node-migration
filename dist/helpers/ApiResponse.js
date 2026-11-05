export var ApiResponseStatus;
(function (ApiResponseStatus) {
    ApiResponseStatus["BadRequest"] = "BadRequest";
    ApiResponseStatus["Successful"] = "Successful";
    ApiResponseStatus["Failed"] = "Failed";
    ApiResponseStatus["UnknownError"] = "UnknownError";
})(ApiResponseStatus || (ApiResponseStatus = {}));
export const GetApiResponseMessages = () => ({
    [ApiResponseStatus.BadRequest]: 400,
    [ApiResponseStatus.Successful]: 200,
    [ApiResponseStatus.Failed]: 500,
    [ApiResponseStatus.UnknownError]: 520,
});
