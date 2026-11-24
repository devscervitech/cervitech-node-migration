# Environment Variables Audit Report

## Summary
This document lists the environment variables in the CerviTech Node.js application, organized by category and purpose. The "Required" column distinguishes variables the API needs to **start** from variables a specific **feature** needs (email, payments). Legacy variables that no code reads are marked as such.

---

## 1. Core Application Configuration

| Variable | Purpose | Required | Default |
|----------|---------|----------|---------|
| `NODE_ENV` | Application environment (production, development, staging). `production` disables the localhost CORS fallback | No (the Docker image sets `production`) | - |
| `PORT` | Port the API listens on (1-65535; invalid values stop startup). The Docker `HEALTHCHECK` probes this port | No | 8000 |
| `APP_PORT` | Host port docker-compose publishes; mapped to the container's `PORT` | No | 8000 |
| `TRUST_PROXY_HOPS` | Exact number of trusted reverse proxies in front of the API (Express `trust proxy` hop count; non-negative integer, invalid values stop startup). Determines the client IP used by per-IP auth rate limiting. Use `0` when clients connect directly; behind a proxy, `0` makes all clients share the proxy's IP, and a value that is too high lets clients spoof their IP via `X-Forwarded-For`. Passed through by docker-compose | No | 0 |
| `LOG_LEVEL` | Winston log level | No | `info` |
| `REMINDER_JOB_ENABLED` / `REMINDER_CRON_SCHEDULE` | See section 9 | No | - |

**Files:** `src/config/runtime.ts`, `src/server.ts`, `src/app.ts`, `src/utils/logger.ts`

### Startup and health checks

`src/server.ts` connects to MongoDB and builds the startup indexes first, then listens on `PORT`, then starts the background jobs. If any of those steps fails, the error is logged and the process exits with code 1. It never stays up half-started.

| Endpoint | Meaning | Status codes |
|----------|---------|--------------|
| `GET /health` | **Liveness:** the process is serving HTTP. Checks no dependencies. Used by the Docker `HEALTHCHECK` | 200 |
| `GET /api/v1/health/push` | Push-delivery statistics (unchanged; not a service health signal) | 200 / 500 |

An unhealthy Docker status is only reported by Docker. Whether the container is restarted or removed from rotation depends on the orchestrator. The liveness probe exposes no internal details. There is no separate readiness endpoint; add one only when a load balancer or orchestrator needs it.

---

## 2. Database Configuration

### MongoDB URI Connection
| Variable | Purpose | Required | Default |
|----------|---------|----------|---------|
| `MONGODB_URI` | Complete MongoDB connection string (`mongodb://` or `mongodb+srv://`). Validated at startup; the API then connects before listening and exits with code 1 if the database is unreachable | Yes (startup) | none (a missing or blank value stops startup) |

**Files:** `src/config/runtime.ts` (validation), `src/server.ts`, `scripts/*.ts`

### TypeORM Configuration (Legacy)
Not read by any code. The TypeORM configuration file has been removed; do not set these.

| Variable | Purpose | Required | Default |
|----------|---------|----------|---------|
| `DB_HOST` | Database hostname (legacy) | No | - |
| `DB_PORT` | Database port (legacy) | No | - |
| `DB_USER` | Database username (legacy) | No | - |
| `DB_PASS` | Database password (legacy) | No | - |
| `DB_NAME` | Database name (legacy) | No | - |

### Docker Compose MongoDB
| Variable | Purpose | Required | Default |
|----------|---------|----------|---------|
| `MONGO_ROOT_USERNAME` | MongoDB root user | No | `cervitech_user` |
| `MONGO_ROOT_PASSWORD` | MongoDB root password | No | - |
| `MONGO_PORT` | MongoDB port mapping | No | 27017 |

**Files:** `docker-compose.yml`

---

## 3. Redis Configuration

| Variable | Purpose | Required | Default |
|----------|---------|----------|---------|
| `REDIS_URL` | Redis connection URL. Passed by docker-compose, but current application code does not read it (kept pending a decision) | No | - |
| `REDIS_PORT` | Redis port mapping for the compose `redis` service | No | 6379 |

**Files:** `docker-compose.yml` only

---

## 4. JWT & Authentication Secrets

| Variable | Purpose | Required | Default |
|----------|---------|----------|---------|
| `JWT_SECRET` | Legacy main JWT secret. In `.env.example` and docker-compose, but current application code does not read it (kept pending a decision) | No | - |
| `APP_USER_JWT_SECRET` | App user access-token signing secret | Yes (startup) | none |
| `BACKOFFICE_JWT_SECRET` | Back office user access-token signing secret | Yes (startup) | none |
| `GENERAL_TOKEN_SECRET` | Signing secret for password-reset and account-deletion tokens | Yes (startup) | none |

The three role-specific secrets are validated at startup, together with `MONGODB_URI`, before any connection is opened. A missing or blank value stops startup with exit code 1, and the log names each missing variable without its value; there are no fallback defaults (see "Token security rollout" below). Values are used exactly as configured (not trimmed).

**Files:** `src/config/runtime.ts` (validation), `src/utils/token.util.ts`

---

## 5. Push Notifications

Push notifications are sent through the Expo push service (`src/services/pushNotificationDriver.ts`), which needs no server credential. The old `FCM_SERVER_KEY` and `FCM_API_URL` variables are not read by any code and have been removed.

| Variable | Purpose | Required | Default |
|----------|---------|----------|---------|
| `PUSH_ALERT_SLACK_WEBHOOK_URL` | Slack webhook for push-delivery failure alerts; alerts are skipped when unset | No | - |
| `ENV_FCM_API_URL` | Legacy: read into `ApplicationConstant` in `applicationConstants.ts`, but the value is never used | No | - |
| `ENV_FCM_SERVER_KEY` | Legacy: read into `ApplicationConstant` in `applicationConstants.ts`, but the value is never used | No | - |

**Files:** `src/services/pushAlert.service.ts`, `src/utils/applicationConstants.ts`

---

## 6. Email Service Configuration

### Azure Communication Services
| Variable | Purpose | Required | Default |
|----------|---------|----------|---------|
| `ACS_CONNECTION_STRING` | Azure Communication Services connection string | Yes, for email* | - |
| `SENDER_EMAIL` | Sender email address for ACS | Yes, for email* | - |

### SMTP/Legacy Email
Email is sent only through ACS. These are legacy variables:

| Variable | Purpose | Required | Default |
|----------|---------|----------|---------|
| `ENV_CERVITECH_EMAIL` | Legacy SMTP account; not read by any code | No | - |
| `ENV_CERVITECH_EMAIL_PASSWORD` | Legacy SMTP password; not read by any code | No | - |
| `ENV_EMAIL_SERVER_PORT` | Legacy SMTP port: read into `ApplicationConstant`, but the value is never used | No | - |

### SendGrid
| Variable | Purpose | Required | Default |
|----------|---------|----------|---------|
| `SENDGRID_API_KEY` | SendGrid is not implemented; not read by any code | No | - |

**Files:**
- `src/utils/EmailService/emailutils.ts`
- `src/utils/EmailService/emailtemplates.ts`
- `src/utils/applicationConstants.ts`

*Required for email features (signup welcome, password-reset OTP, account deletion, monthly reminder). The API starts without them. The ACS client is created on the first send, and sends fail with an `EmailConfigurationError` if either value is missing or the connection string is malformed. That error never includes the connection string.

---

## 7. URL Configuration

| Variable | Purpose | Required | Default |
|----------|---------|----------|---------|
| `BACKEND_URL` | Backend server base URL used in email links | Yes, for email | - |
| `FRONTEND_URL` | Absolute http(s) frontend URL. Used for email links and as the **only** origin allowed by CORS (credentialed). An invalid value stops startup. If unset, `http://localhost:5173` is allowed outside production, and in production cross-origin browser access is disabled (requests without an `Origin` header, such as the mobile app, are unaffected) | Yes, for browser clients and email | - |
| `ENV_BASE_URL` | Legacy: read into `ApplicationConstant`, but the value is never used | No | - |
| `ENV_WEBSITE_APP_URL` | Legacy; not read by any code | No | - |

**Files:**
- `src/config/runtime.ts` (CORS origin)
- `src/utils/EmailService/emailtemplates.ts`
- `src/utils/applicationConstants.ts`

---

## 8a. Google Play Billing

| Variable | Purpose | Required | Default |
|----------|---------|----------|---------|
| `GOOGLE_PLAY_SERVICE_ACCOUNT_KEY` | JSON key (single line) for a Google Cloud service account with Finance/Orders access in Play Console; used to verify purchase tokens against the Android Publisher API | Yes, for purchases* | - |
| `GOOGLE_PLAY_PACKAGE_NAME` | Android package name the subscriptions belong to, e.g. `com.cervitech.app` | Yes, for purchases* | - |
| `GOOGLE_PLAY_SUBSCRIPTION_IDS` | Comma-separated allowlist of subscription product IDs the server accepts, e.g. `premium_monthly,premium_yearly`; whitespace around commas is ignored | Yes, for purchases* | - |

**Files:** `src/services/googlePlay.service.ts`, `src/jobs/subscriptionSync.job.ts`, `src/services/transaction.service.ts`

*Required to accept payments, not for startup: the API starts without them. `POST /transaction` only accepts a Google Play `purchaseToken` that has been verified server-side. Submissions without one are rejected with `PURCHASE_TOKEN_INVALID` (400), and there is no unverified fallback. If any of the three variables is unset, purchases are rejected with `GOOGLE_PLAY_CONFIGURATION_MISSING` (500), and the 15-minute subscription-sync job logs a warning and skips each run.

---

## 8. Environment Colors

Used for logging and UI indication of environment status.

| Variable | Purpose | Example Value |
|----------|---------|----------------|
| `ENV_COLOR_GREEN` | Green color code | `#22c55e` |
| `ENV_COLOR_BLUE` | Blue color code | `#3b82f6` |
| `ENV_COLOR_YELLOW` | Yellow color code | `#eab308` |
| `ENV_COLOR_ORANGE` | Orange color code | `#f97316` |
| `ENV_COLOR_RED` | Red color code | `#ef4444` |

**Files:** `src/utils/applicationConstants.ts`, `src/utils/utils.ts`

---

## 9. Application Settings & Constants

| Variable | Purpose | Default |
|----------|---------|---------|
| `ENV_TEST` | Legacy test mode flag; not read by any code | - |
| `ENV_NUMBER_OF_RECORD_POST_BEFORE_SENDING_AVERAGE_NECK_ANGLE` | Neck angle records threshold (positive integer; other values fall back to the default) | `5` |
| `ENV_DEFAULT_PROMPT` | Legacy: read into `ApplicationConstant`, but the value is never used | - |
| `ENV_DB_CONN` | Legacy database connection string; not read by any code | - |
| `OTP_DEBUG` | `true` returns the generated OTP in the reset-request response. Dev/test only | `false` |
| `REMINDER_JOB_ENABLED` | `false` disables the monthly re-engagement email job and its boot catch-up | enabled |
| `REMINDER_CRON_SCHEDULE` | Cron schedule (UTC) for the monthly re-engagement email | `0 9 14 * *` |

**Files:**
- `src/utils/applicationConstants.ts`
- `src/services/appUserServices/neckAngle.service.ts`
- `src/services/otp.service.ts`
- `src/jobs/monthlyReminder.job.ts`

---

## Critical Variables for Deployment

**Required to start** (the API exits with code 1 without them):
1. ✅ `MONGODB_URI` - Database connection; startup connects before listening
2. ✅ `APP_USER_JWT_SECRET`, `BACKOFFICE_JWT_SECRET`, `GENERAL_TOKEN_SECRET` - Token signing secrets; blank values stop startup

**Required for specific features** (the API starts without them):
- `FRONTEND_URL` - Allowed browser origin and email links. Without it, production cross-origin browser access is disabled
- `ACS_CONNECTION_STRING`, `SENDER_EMAIL`, `BACKEND_URL` - Email delivery
- `GOOGLE_PLAY_SERVICE_ACCOUNT_KEY`, `GOOGLE_PLAY_PACKAGE_NAME`, `GOOGLE_PLAY_SUBSCRIPTION_IDS` - Accepting purchases

---

## Variables by Priority

### Priority 1 (Critical - Application won't start)
- `MONGODB_URI` (startup exits with code 1 if the database is unreachable)
- `APP_USER_JWT_SECRET`, `BACKOFFICE_JWT_SECRET`, `GENERAL_TOKEN_SECRET` (no fallback defaults)

### Priority 2 (Important - Features won't work)
- `FRONTEND_URL` (browser clients in production; email links)
- `ACS_CONNECTION_STRING`, `SENDER_EMAIL`, `BACKEND_URL` (email)
- `GOOGLE_PLAY_SERVICE_ACCOUNT_KEY`, `GOOGLE_PLAY_PACKAGE_NAME`, `GOOGLE_PLAY_SUBSCRIPTION_IDS` (payments)

### Priority 3 (Optional - Has defaults)
- `PORT` (defaults to 8000)
- `NODE_ENV` (the Docker image sets `production`; when unset, the localhost CORS fallback applies)
- `TRUST_PROXY_HOPS` (defaults to 0; set it to the exact proxy count behind a reverse proxy)
- `LOG_LEVEL`, `OTP_DEBUG`, `REMINDER_JOB_ENABLED`, `REMINDER_CRON_SCHEDULE`, `PUSH_ALERT_SLACK_WEBHOOK_URL`
- Color constants (have empty string defaults)

### Not read by the application
- `JWT_SECRET`, `REDIS_URL` - In `.env.example` and docker-compose but unused by current code; kept pending a decision
- The legacy variables marked as such in the sections above

---

## Deployment Checklist

- [ ] All Priority 1 variables configured
- [ ] Priority 2 variables configured for the features this deployment uses
- [ ] `.env` file created (copy from `.env.example`)
- [ ] `.env` file added to `.gitignore` and `.dockerignore`
- [ ] `docker-compose.yml` updated with all variables
- [ ] Secrets securely stored (not in source control)
- [ ] If sending email: ACS connection string and sender configured
- [ ] If accepting purchases: Google Play service account, package name and subscription IDs set
- [ ] JWT secrets are strong and unique
- [ ] Database credentials are secure
- [ ] URLs point to correct endpoints

---

## Notes

- Environment variables take precedence over defaults
- When deploying to Docker, ensure `.env` file is in the project root
- Docker Compose automatically loads variables from `.env`
- Never commit `.env` to version control
- Use strong, unique values for all secrets
- Rotate secrets regularly in production

Google Play payments require `GOOGLE_PLAY_SUBSCRIPTION_IDS` (see section 8a). Legacy status-only payment submissions are rejected. Existing duplicate paymentRef records must be reconciled before creating the unique paymentRef index in production.

### Logging and credential exposure response

`LOG_LEVEL` controls Winston verbosity (default `info`). Logs are structured JSON on stdout with recursive credential redaction and exception/rejection handlers. Configure retention, rotation, access controls, and aggregation in the container runtime or log collector; no local log file is maintained.

Remove retained signup payloads, deletion/reset tokens, and user/health records from accessible logs under the incident retention policy. Identify accounts created while plaintext signup logging was deployed using account creation dates and deployment history, without exporting their logged passwords. Require password resets for affected accounts and invalidate affected sessions. Rotate affected signing credentials if signing material was exposed; expired action tokens do not need reissuing. Coordinate account recovery and user notification before production changes. This patch does not rotate account passwords, purge historical logs, or revoke sessions.

### UTC date handling rollout

New goal `dateSet` and compliance `dateOfConcludedCycle` values store the actual instant. Goal cycles, dashboard day/week boundaries, response-rate hourly buckets, and cron schedules use UTC. Calendar weeks start Monday; monthly charts retain a sixth partial week where present.

Do not bulk-subtract one hour from historical timestamps: the old helper depended on the writer's host timezone. Leave existing values unchanged until deployment history and independent creation timestamps identify affected records. For records proven to have been written on UTC hosts by the old helper, a one-hour correction may be appropriate; review associated cycle boundaries and completed reports together before applying a backed-up, audited migration. Other host timezones require reconstructing the actual offset. Never move completed cycles or resend notifications automatically as part of this deployment.

### Token security rollout

`APP_USER_JWT_SECRET`, `BACKOFFICE_JWT_SECRET`, and `GENERAL_TOKEN_SECRET` are required at boot; blank values are rejected. Use independent signing secrets. Reset/deletion tokens issued before audience scoping must be reissued.

Before deploying, pause auth writes and migrate `tokenblacklists`: populate `expiresAt` from each JWT's numeric `exp`, reconcile duplicate tokens while retaining the latest expiry, drop the old `createdAt_1` TTL index, and create unique `{ token: 1 }` and TTL `{ expiresAt: 1 }` (`expireAfterSeconds: 0`) indexes. Retain malformed legacy entries for review rather than deleting them. Verify the indexes before resuming traffic. Schema changes alone do not remove the old TTL index. Tokens already removed by that index cannot be recovered; rotating access-token secrets invalidates those sessions and requires users to sign in again.

Authenticated endpoints return 503 when blacklist/user lookup fails; invalid credentials continue to return 403 (revoked tokens return 401).
