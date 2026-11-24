# Essential Environment Variables

Quick reference for deploying the API. `.env.example` is the commented template and [ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md) has the full details.

## 1. Core startup configuration

The API does not start without these:
- `MONGODB_URI` - MongoDB connection string (`mongodb://` or `mongodb+srv://`). There is no default: a missing or blank value stops startup. Startup connects before listening and exits with code 1 if the database is unreachable.
- `APP_USER_JWT_SECRET` - App user token signing secret
- `BACKOFFICE_JWT_SECRET` - Back office user token signing secret
- `GENERAL_TOKEN_SECRET` - Signing secret for reset and account-deletion tokens

All four are validated at startup, before any connection is opened. A missing or blank value stops startup with exit code 1, and the log names each missing variable (never its value). Use independent, strong values for the three signing secrets.

Startup settings that have defaults (invalid values stop startup):
- `NODE_ENV` - Application environment. The Docker image sets `production`. Only `production` disables the localhost CORS fallback.
- `PORT` - Port the API listens on (default `8000`)
- `TRUST_PROXY_HOPS` - Exact number of trusted reverse proxies in front of the API (default `0`)
- `FRONTEND_URL` - Absolute http(s) frontend URL. Its origin is the only browser origin allowed by CORS. If it is unset in production, browsers on other origins cannot call the API (mobile clients are unaffected). It is also used in email links.

## 2. Email configuration (Azure Communication Services)

Required for email delivery (signup welcome, password-reset OTP, account deletion, monthly reminder), not for startup. Without them the API starts normally and email sends fail with an `EmailConfigurationError`.
- `ACS_CONNECTION_STRING` - Azure Communication Services connection string
- `SENDER_EMAIL` - Sender email address
- `BACKEND_URL` - Backend base URL used in email links (`FRONTEND_URL` above is used in email links too)

## 3. Google Play billing configuration

Required to verify and accept purchases, not for startup. If any is unset, purchases are rejected with `GOOGLE_PLAY_CONFIGURATION_MISSING` and the subscription-sync job skips its runs.
- `GOOGLE_PLAY_SERVICE_ACCOUNT_KEY` - Service-account JSON key (single line)
- `GOOGLE_PLAY_PACKAGE_NAME` - Android package name
- `GOOGLE_PLAY_SUBSCRIPTION_IDS` - Comma-separated allowlist of subscription product IDs

## 4. Optional settings

All have defaults:
- `LOG_LEVEL` - Winston log level (default `info`)
- `OTP_DEBUG` - Return the reset OTP in the API response; dev/test only (default `false`)
- `REMINDER_JOB_ENABLED` - `false` disables the monthly re-engagement email job (enabled by default)
- `REMINDER_CRON_SCHEDULE` - Cron schedule (UTC) for that job (default `0 9 14 * *`)
- `PUSH_ALERT_SLACK_WEBHOOK_URL` - Slack webhook for push-delivery failure alerts; alerts are skipped when unset
- `ENV_NUMBER_OF_RECORD_POST_BEFORE_SENDING_AVERAGE_NECK_ANGLE` - Neck angle record threshold (default `5`)
- `ENV_COLOR_GREEN`, `ENV_COLOR_BLUE`, `ENV_COLOR_YELLOW`, `ENV_COLOR_ORANGE`, `ENV_COLOR_RED` - Color hex codes (default empty)

Push notifications go through Expo and need no server key.

## Docker Compose-only variables

Used by `docker-compose.yml`, not read by the application:
- `APP_PORT` - Host port published for the API (mapped to the container's `PORT`)
- `MONGO_ROOT_USERNAME` - MongoDB initialization user
- `MONGO_ROOT_PASSWORD` - MongoDB initialization password
- `MONGO_PORT` - MongoDB port mapping (27017)
- `REDIS_PORT` - Redis port mapping (6379)

## In the template but not read by the application

`JWT_SECRET` and `REDIS_URL` appear in `.env.example` and are passed by `docker-compose.yml`, but current application code reads neither. Setting them has no effect. They are kept pending a decision on whether to remove them.

## Legacy and unused variables

Not read by any code; do not set them:
- `FCM_SERVER_KEY`, `FCM_API_URL` - Not read; push uses Expo
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME` - Old TypeORM configuration
- `ENV_CERVITECH_EMAIL`, `ENV_CERVITECH_EMAIL_PASSWORD` - Old SMTP configuration (email uses ACS)
- `ENV_WEBSITE_APP_URL`, `ENV_TEST`, `ENV_DB_CONN`
- `SENDGRID_API_KEY` - SendGrid is not implemented

Read into `ApplicationConstant` (`src/utils/applicationConstants.ts`), but the values are never used and they are not in `.env.example`:
- `ENV_FCM_API_URL`, `ENV_FCM_SERVER_KEY`, `ENV_EMAIL_SERVER_PORT`, `ENV_BASE_URL`, `ENV_DEFAULT_PROMPT`

## Setup Instructions

1. **Copy template:**
   ```bash
   cp .env.example .env
   ```

2. **Edit .env with your actual values** (especially the secrets)

3. **Start services:**
   ```bash
   docker-compose up -d
   ```

## Deployment Checklist

- [ ] `.env` file created from `.env.example`
- [ ] `MONGODB_URI` reachable from where the API runs
- [ ] `APP_USER_JWT_SECRET`, `BACKOFFICE_JWT_SECRET` and `GENERAL_TOKEN_SECRET` set to strong, independent values
- [ ] `PORT`, `APP_PORT` and `TRUST_PROXY_HOPS` match your network setup
- [ ] `FRONTEND_URL` set to the frontend's URL (needed for browser clients in production)
- [ ] If the deployment sends email: `ACS_CONNECTION_STRING`, `SENDER_EMAIL` and `BACKEND_URL` set
- [ ] If the deployment accepts purchases: the three `GOOGLE_PLAY_*` variables set
- [ ] Database credentials are secure
- [ ] `.env` added to `.gitignore`
- [ ] `.env` is NOT committed to version control
