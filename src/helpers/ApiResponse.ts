export enum ApiResponseStatus {
  BadRequest = "BadRequest",
  Successful = "Successful",
  Failed = "Failed",
  UnknownError = "UnknownError"
}

export const GetApiResponseMessages = () => ({
  [ApiResponseStatus.BadRequest]: 400,
  [ApiResponseStatus.Successful]: 200,
  [ApiResponseStatus.Failed]: 500,
  [ApiResponseStatus.UnknownError]: 520,
});