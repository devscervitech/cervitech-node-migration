
const ApiResponseStatus = {
  BadRequest: 'BadRequest',
  Successful: 'Successful',
  Failed: 'Failed',
  UnknownError: 'UnknownError',
};

function getApiResponseMessages() {
  return {
    [ApiResponseStatus.BadRequest]: 400,
    [ApiResponseStatus.Successful]: 200,
    [ApiResponseStatus.Failed]: 500,
    [ApiResponseStatus.UnknownError]: 500,
  };
}

export { getApiResponseMessages, ApiResponseStatus };