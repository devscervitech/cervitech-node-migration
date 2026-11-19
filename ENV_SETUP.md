# Essential Environment Variables

**Total Required: 18 Variables**

## Quick Reference

### 1. Core Application (2)
- `NODE_ENV` - Application environment (production/development)
- `PORT` - Server port (default: 8000)

### 2. Database & Cache (2)
- `MONGODB_URI` - MongoDB connection string
- `REDIS_URL` - Redis connection URL

### 3. Authentication (4)
- `JWT_SECRET` - Main JWT signing secret
- `APP_USER_JWT_SECRET` - App user token secret
- `BACKOFFICE_JWT_SECRET` - Back office user token secret
- `GENERAL_TOKEN_SECRET` - General purpose token secret

### 4. Push Notifications (1)
- `FCM_SERVER_KEY` - Firebase Cloud Messaging server key

### 5. Email Service (2)
- `ACS_CONNECTION_STRING` - Azure Communication Services connection
- `SENDER_EMAIL` - Sender email address

### 6. URLs (2)
- `BACKEND_URL` - Backend base URL (for email templates)
- `FRONTEND_URL` - Frontend URL (for email templates)

### 7. UI Colors (5)
- `ENV_COLOR_GREEN` - Green color hex code
- `ENV_COLOR_BLUE` - Blue color hex code
- `ENV_COLOR_YELLOW` - Yellow color hex code
- `ENV_COLOR_ORANGE` - Orange color hex code
- `ENV_COLOR_RED` - Red color hex code

### 8. Application Settings (1)
- `ENV_NUMBER_OF_RECORD_POST_BEFORE_SENDING_AVERAGE_NECK_ANGLE` - Neck angle record threshold

## Docker-Only Variables (not used in app code)
These are only needed for Docker Compose but don't affect the application:
- `MONGO_ROOT_USERNAME` - MongoDB initialization user
- `MONGO_ROOT_PASSWORD` - MongoDB initialization password
- `MONGO_PORT` - MongoDB port mapping (27017)
- `REDIS_PORT` - Redis port mapping (6379)

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

## Removed Variables (Legacy/Unused)

The following were removed as they are no longer used:
- `APP_PORT` - Not used in application code
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME` - TypeORM legacy config
- `FCM_API_URL` - Uses hardcoded default
- `ENV_FCM_API_URL`, `ENV_FCM_SERVER_KEY` - Duplicate legacy variables
- `ENV_CERVITECH_EMAIL`, `ENV_CERVITECH_EMAIL_PASSWORD`, `ENV_EMAIL_SERVER_PORT` - Legacy SMTP (now using ACS)
- `ENV_BASE_URL`, `ENV_WEBSITE_APP_URL`, `ENV_TEST`, `ENV_DEFAULT_PROMPT`, `ENV_DB_CONN` - Unused variables
- `SENDGRID_API_KEY` - Not implemented

## Deployment Checklist

- [ ] `.env` file created from `.env.example`
- [ ] All 18 variables configured with real values
- [ ] Strong secrets used for all JWT and API keys
- [ ] Database credentials are secure
- [ ] Email service configured (ACS connection string & sender email)
- [ ] URLs point to correct endpoints
- [ ] `.env` added to `.gitignore`
- [ ] `.env` is NOT committed to version control
