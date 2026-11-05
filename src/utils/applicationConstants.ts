import dotenv from 'dotenv';

dotenv.config();

export class ApplicationConstant {
  public static ENV_COLOR_GREEN = process.env.ENV_COLOR_GREEN || '';
  public static ENV_COLOR_BLUE = process.env.ENV_COLOR_BLUE || '';
  public static ENV_COLOR_YELLOW = process.env.ENV_COLOR_YELLOW || '';
  public static ENV_COLOR_ORANGE = process.env.ENV_COLOR_ORANGE || '';
  public static ENV_COLOR_RED = process.env.ENV_COLOR_RED || '';

  public static ENV_TEST = process.env.ENV_TEST || '';
  public static ENV_WEBSITE_APP_URL = process.env.ENV_WEBSITE_APP_URL || '';
  public static ENV_CERVITECH_EMAIL = process.env.ENV_CERVITECH_EMAIL || '';
  public static ENV_CERVITECH_EMAIL_PASSWORD = process.env.ENV_CERVITECH_EMAIL_PASSWORD || '';
  public static ENV_EMAIL_SERVER_PORT = process.env.ENV_EMAIL_SERVER_PORT || '';
  public static ENV_FCM_API_URL = process.env.ENV_FCM_API_URL || '';
  public static ENV_FCM_SERVER_KEY = process.env.ENV_FCM_SERVER_KEY || '';
  public static ENV_NUMBER_OF_RECORD_POST_BEFORE_SENDING_AVERAGE_NECK_ANGLE = process.env.ENV_NUMBER_OF_RECORD_POST_BEFORE_SENDING_AVERAGE_NECK_ANGLE || '';
  public static ENV_DEFAULT_PROMPT = process.env.ENV_DEFAULT_PROMPT || '';
  public static ENV_BASE_URL = process.env.ENV_BASE_URL || '';
  public static ENV_DB_CONN = process.env.ENV_DB_CONN || '';
}
