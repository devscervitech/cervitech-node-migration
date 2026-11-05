import dotenv from 'dotenv';
dotenv.config();
export class ApplicationConstant {
}
ApplicationConstant.ENV_COLOR_GREEN = process.env.ENV_COLOR_GREEN || '';
ApplicationConstant.ENV_COLOR_BLUE = process.env.ENV_COLOR_BLUE || '';
ApplicationConstant.ENV_COLOR_YELLOW = process.env.ENV_COLOR_YELLOW || '';
ApplicationConstant.ENV_COLOR_ORANGE = process.env.ENV_COLOR_ORANGE || '';
ApplicationConstant.ENV_COLOR_RED = process.env.ENV_COLOR_RED || '';
ApplicationConstant.ENV_TEST = process.env.ENV_TEST || '';
ApplicationConstant.ENV_WEBSITE_APP_URL = process.env.ENV_WEBSITE_APP_URL || '';
ApplicationConstant.ENV_CERVITECH_EMAIL = process.env.ENV_CERVITECH_EMAIL || '';
ApplicationConstant.ENV_CERVITECH_EMAIL_PASSWORD = process.env.ENV_CERVITECH_EMAIL_PASSWORD || '';
ApplicationConstant.ENV_EMAIL_SERVER_PORT = process.env.ENV_EMAIL_SERVER_PORT || '';
ApplicationConstant.ENV_FCM_API_URL = process.env.ENV_FCM_API_URL || '';
ApplicationConstant.ENV_FCM_SERVER_KEY = process.env.ENV_FCM_SERVER_KEY || '';
ApplicationConstant.ENV_NUMBER_OF_RECORD_POST_BEFORE_SENDING_AVERAGE_NECK_ANGLE = process.env.ENV_NUMBER_OF_RECORD_POST_BEFORE_SENDING_AVERAGE_NECK_ANGLE || '';
ApplicationConstant.ENV_DEFAULT_PROMPT = process.env.ENV_DEFAULT_PROMPT || '';
ApplicationConstant.ENV_BASE_URL = process.env.ENV_BASE_URL || '';
ApplicationConstant.ENV_DB_CONN = process.env.ENV_DB_CONN || '';
