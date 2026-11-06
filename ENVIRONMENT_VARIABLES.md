# Environment Variables Audit Report

## Summary
This document lists all environment variables used in the CerviTech Node.js application, organized by category and purpose.

**Total Environment Variables: 48**

---

## 1. Core Application Configuration (3)

| Variable | Purpose | Required | Default |
|----------|---------|----------|---------|
| `NODE_ENV` | Application environment (production, development, staging) | Yes | - |
| `PORT` | Server port number | No | 4000 |
| `APP_PORT` | Docker compose app port mapping | No | 8000 |

**Files:** `src/server.ts`

---

## 2. Database Configuration (8)

### MongoDB URI Connection
| Variable | Purpose | Required | Default |
|----------|---------|----------|---------|
| `MONGODB_URI` | Complete MongoDB connection string | Yes | `mongodb://localhost:27017/cervitechdb` |

**Files:** `src/server.ts`

### TypeORM Configuration (Legacy)
| Variable | Purpose | Required | Default |
|----------|---------|----------|---------|
| `DB_HOST` | Database hostname | No | - |
| `DB_PORT` | Database port | No | - |
| `DB_USER` | Database username | No | - |
| `DB_PASS` | Database password | No | - |
| `DB_NAME` | Database name | No | - |

**Files:** `src/config/CerviTechDbContext.ts`

### Docker Compose MongoDB
| Variable | Purpose | Required | Default |
|----------|---------|----------|---------|
| `MONGO_ROOT_USERNAME` | MongoDB root user | No | `cervitech_user` |
| `MONGO_ROOT_PASSWORD` | MongoDB root password | No | - |
| `MONGO_PORT` | MongoDB port mapping | No | 27017 |

**Files:** `docker-compose.yml`

---

## 3. Redis Configuration (2)

| Variable | Purpose | Required | Default |
|----------|---------|----------|---------|
| `REDIS_URL` | Redis connection URL | Yes | - |
| `REDIS_PORT` | Redis port mapping | No | 6379 |

**Files:** `docker-compose.yml`, Application setup

---

## 4. JWT & Authentication Secrets (4)

| Variable | Purpose | Required | Default |
|----------|---------|----------|---------|
| `JWT_SECRET` | Main JWT signing secret | Yes | `your-secret-key` |
| `APP_USER_JWT_SECRET` | App user token secret | No | `appuser-secret-key` |
| `BACKOFFICE_JWT_SECRET` | Back office user token secret | No | `backoffice-secret-key` |
| `GENERAL_TOKEN_SECRET` | General purpose token secret | No | `general-secret-key` |

**Files:**
- `src/utils/verifyToken.ts`
- `src/utils/token.util.ts`

---

## 5. Firebase Cloud Messaging (FCM) (4)

| Variable | Purpose | Required | Default |
|----------|---------|----------|---------|
| `FCM_API_URL` | FCM API endpoint | No | `https://fcm.googleapis.com` |
| `FCM_SERVER_KEY` | FCM server key for push notifications | Yes | - |
| `ENV_FCM_API_URL` | Legacy FCM API URL | No | - |
| `ENV_FCM_SERVER_KEY` | Legacy FCM server key | No | - |

**Files:** `src/services/pushNotificationDriver.ts`, `src/utils/applicationConstants.ts`

---

## 6. Email Service Configuration (6)

### Azure Communication Services
| Variable | Purpose | Required | Default |
|----------|---------|----------|---------|
| `ACS_CONNECTION_STRING` | Azure Communication Services connection string | Yes* | - |
| `SENDER_EMAIL` | Sender email address for ACS | Yes* | - |

### SMTP/Legacy Email
| Variable | Purpose | Required | Default |
|----------|---------|----------|---------|
| `ENV_CERVITECH_EMAIL` | Email account for sending | No | - |
| `ENV_CERVITECH_EMAIL_PASSWORD` | Email account password | No | - |
| `ENV_EMAIL_SERVER_PORT` | SMTP server port | No | - |

### SendGrid (Alternative)
| Variable | Purpose | Required | Default |
|----------|---------|----------|---------|
| `SENDGRID_API_KEY` | SendGrid API key | No | - |

**Files:**
- `src/utils/EmailService/emailutils.ts`
- `src/utils/EmailService/emailtemplates.ts`
- `src/utils/applicationConstants.ts`

*Required if using Azure Communication Services for email

---

## 7. URL Configuration (4)

| Variable | Purpose | Required | Default |
|----------|---------|----------|---------|
| `BACKEND_URL` | Backend server base URL (for email templates) | Yes | - |
| `FRONTEND_URL` | Frontend application URL (for email templates) | Yes | - |
| `ENV_BASE_URL` | Legacy base URL constant | No | - |
| `ENV_WEBSITE_APP_URL` | CerviTech website URL | No | - |

**Files:**
- `src/server.ts`
- `src/utils/EmailService/emailtemplates.ts`
- `src/utils/applicationConstants.ts`

---

## 8a. Google Play Billing (2)

| Variable | Purpose | Required | Default |
|----------|---------|----------|---------|
| `GOOGLE_PLAY_SERVICE_ACCOUNT_KEY` | JSON key for a Google Cloud service account with Finance/Orders access in Play Console; used to verify purchase tokens against the Android Publisher API | No* | - |
| `GOOGLE_PLAY_PACKAGE_NAME` | Android package name the subscriptions belong to | No* | - |

**Files:** `src/services/googlePlay.service.ts`, `src/jobs/subscriptionSync.job.ts`, `src/services/transaction.service.ts`

*Required only to verify Play purchase tokens (`POST /transaction` with `purchaseToken`) and to run the subscription-sync job. Without it, `POST /transaction` still works via the legacy client-submitted-status path, and the sync job logs a warning and no-ops on each scheduled run.

---

## 8. Environment Colors (5)

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

## 9. Application Settings & Constants (12)

| Variable | Purpose | Default |
|----------|---------|---------|
| `ENV_TEST` | Test mode flag | `false` |
| `ENV_NUMBER_OF_RECORD_POST_BEFORE_SENDING_AVERAGE_NECK_ANGLE` | Neck angle records threshold | `0` |
| `ENV_DEFAULT_PROMPT` | Default AI/ML prompt | - |
| `ENV_DB_CONN` | Database connection string (legacy) | - |

**Files:**
- `src/utils/applicationConstants.ts`
- `src/services/appUserServices/neckAngle.service.ts`

---

## Critical Variables for Deployment

**Must be set:**
1. ✅ `MONGODB_URI` - Database connection
2. ✅ `REDIS_URL` - Redis cache connection
3. ✅ `JWT_SECRET` - Authentication key
4. ✅ `FCM_SERVER_KEY` - Push notifications
5. ✅ `ACS_CONNECTION_STRING` - Email service
6. ✅ `SENDER_EMAIL` - Email sender
7. ✅ `BACKEND_URL` - Backend base URL
8. ✅ `FRONTEND_URL` - Frontend base URL

---

## Variables by Priority

### Priority 1 (Critical - Application won't run)
- `MONGODB_URI`
- `JWT_SECRET`
- `ACS_CONNECTION_STRING`
- `SENDER_EMAIL`

### Priority 2 (Important - Features won't work)
- `REDIS_URL`
- `FCM_SERVER_KEY`
- `BACKEND_URL`
- `FRONTEND_URL`

### Priority 3 (Optional - Has defaults)
- `PORT` (defaults to 4000)
- `NODE_ENV` (defaults to development)
- `FCM_API_URL` (defaults to Firebase endpoint)
- JWT role-specific secrets (have fallback defaults)
- Color constants (have empty string defaults)
- Email credentials (only if using SMTP instead of ACS)

---

## Deployment Checklist

- [ ] All Priority 1 variables configured
- [ ] All Priority 2 variables configured
- [ ] `.env` file created (copy from `.env.example`)
- [ ] `.env` file added to `.gitignore` and `.dockerignore`
- [ ] `docker-compose.yml` updated with all variables
- [ ] Secrets securely stored (not in source control)
- [ ] Email service configured (ACS or SendGrid)
- [ ] FCM credentials obtained and set
- [ ] JWT secrets are strong and unique
- [ ] Database credentials are secure
- [ ] URLs point to correct endpoints
- [ ] Redis instance is accessible

---

## Notes

- Environment variables take precedence over defaults
- When deploying to Docker, ensure `.env` file is in the project root
- Docker Compose automatically loads variables from `.env`
- Never commit `.env` to version control
- Use strong, unique values for all secrets
- Rotate secrets regularly in production

Google Play payments require `GOOGLE_PLAY_SUBSCRIPTION_IDS`: a comma-separated allowlist of subscription product IDs. Legacy status-only payment submissions are rejected. Existing duplicate paymentRef records must be reconciled before creating the unique paymentRef index in production.
