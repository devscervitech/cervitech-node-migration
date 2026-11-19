# API Endpoints

Base URL: `/api/v1`

Password inputs have all whitespace removed before validation, verification, and hashing. This applies to app-user and back-office signup, login, password changes, and resets.

Back-office access levels are `ADMIN` and `OPERATOR`. Only `ADMIN` accounts can manage back-office accounts; `readOnly: true` blocks administrative writes regardless of access level. Self-service logout and password changes remain available. `OPERATOR` is reserved for operational back-office endpoints, but this repository currently has no operational endpoint assigned to it. Authenticated app-user routes require the `APP_USER` token role and reject back-office tokens.

## Auth (`/api/v1/auth`)

Successful auth responses use `{ success, message, data }`; username and email checks return their boolean under `data.exists` and `data.isValid`. Public auth endpoints have per-IP rate limits and return HTTP 429 with `Retry-After` when a limit is exceeded. Configure `TRUST_PROXY_HOPS` to the number of trusted reverse proxies; use `0` when clients connect directly. Signup, login, password-reset, username-check, and email-check limits are documented in their OpenAPI route definitions.

The app-user limits are: signup 5/hour; login 10/15 minutes; reset request 5/15 minutes; OTP verification 10/15 minutes; reset attempts 10/15 minutes; username check 60/15 minutes; email check 30/15 minutes. Back-office login is limited to 10/15 minutes, reset requests to 5/15 minutes, and OTP verification/reset attempts to 10/15 minutes.

- POST `/signup` — public — `AuthController.signup` — body: `username, email, password`
- PUT `/change-password` — auth+role `APP_USER` — `AuthController.changePassword` — body: `oldPassword, newPassword`
- POST `/request-reset` — public — `AuthController.sendPasswordToken` — body: `email` (sends a 6-digit OTP; returns `otp` in the response only when `OTP_DEBUG=true`)
- POST `/verify-reset-otp` — public — `AuthController.verifyResetOtp` — body: `email, otp` (returns `data.token`, a short-lived reset JWT)
- POST `/reset-password` — public — `AuthController.resetPassword` — body: `token, newPassword`
- POST `/login` — public — `AuthController.authenticate` — body: `emailOrUsername, password`
- POST `/logout` — auth+role `APP_USER` — `AuthController.logout`
- GET `/usernames/exists` — public — `AuthController.usernameAlreadyExists` — query: `username`
- GET `/validate-email` — public — `AuthController.isValidEmail` — query: `email`

## Backoffice Users (`/api/v1/backoffice-users`)

- POST `/signup` — auth+role `BACKOFFICE_USER`+`ADMIN`+writable — `BackOfficeUserController.createUser` — body: user fields
- POST `/login` — public — `BackOfficeUserController.loginController` — body: credentials
- POST `/forgot-password` — public — `BackOfficeUserController.forgotPassword` — body: `email` (sends a 6-digit OTP; always returns a generic message and never returns the OTP)
- POST `/verify-reset-otp` — public — `BackOfficeUserController.verifyResetOtp` — body: `email, otp` (returns `data.token`)
- POST `/reset-password` — public — `BackOfficeUserController.resetPassword` — body: `token, newPassword`
- POST `/logout` — auth+role `BACKOFFICE_USER` — `BackOfficeUserController.logoutController`
- POST `/change-password` — auth+role `BACKOFFICE_USER` — `BackOfficeUserController.changePassword` — body: `currentPassword, newPassword`
- GET `/` — auth+role `BACKOFFICE_USER`+`ADMIN` — `BackOfficeUserController.getUsers`
- DELETE `/:id` — auth+role `BACKOFFICE_USER`+`ADMIN`+writable; blocks self/last-admin deletion — `BackOfficeUserController.deleteUser`
- PUT `/:id` — auth+role `BACKOFFICE_USER`+`ADMIN`+writable — `BackOfficeUserController.updateUser` — profile fields only
- PUT `/:id/access` — auth+role `BACKOFFICE_USER`+`ADMIN`+writable; blocks self/last-admin changes — `BackOfficeUserController.updateAccess`
- GET `/:id` — auth+role `BACKOFFICE_USER`+`ADMIN` — `BackOfficeUserController.testUserById`

## Email (`/api/v1/email`)

- POST `/sign-up` — `EmailController.signup` — body: email template data
- POST `/password-reset` — `EmailController.passwordReset` — body: `to, username, code`
- POST `/account-deletion-request` — `EmailController.accountDeletionRequest`
- POST `/account-deletion` — `EmailController.accountDeletion`
- POST `/reminder` — `EmailController.reminder`

## FCM (`/api/v1/fcm`)

- PUT `/token` — auth+role `APP_USER` — `FCMController.updateFCMToken` — body: `fcmToken`

## Goals (`/api/v1/goals`)

- POST `/turn-on` — auth+role `APP_USER` — `GoalController.turnOnGoalByUserId` — body: `targetedAverageNeckAngle, frequency`
- PUT `/turn-off` — auth+role `APP_USER` — `GoalController.turnOffGoalByUserId` — body: goal data
- GET `/user-goals` — auth+role `APP_USER` — `GoalController.getGoalsByUserId`
- GET `/neck-angle` — auth+role `APP_USER` — `GoalController.getCurrentTargetedAverageNeckAngle`

## Neck Angle (`/api/v1/neck-angle`)

- POST `/records/batch` — auth+role `APP_USER`; records are assigned to the authenticated user — `NeckAngleController.postBatchNeckAngleRecords` — body: `neckAngleRecords`
- POST `/records/random` — auth+role `BACKOFFICE_USER`+`ADMIN`+writable — `NeckAngleController.postRandomTestBatchNeckAngleRecords`
- GET `/stats` — auth+role `APP_USER` — `NeckAngleController.getUserNeckAngleStatistics`
- POST `/notification-count/reset` — auth+role `APP_USER` — `NeckAngleController.resetNotificationCount`
- GET `/test-users` — auth+role `BACKOFFICE_USER`+`ADMIN` — `NeckAngleController.getUsersForTesting`
- GET `/reports/current-day` — `NeckAngleController.getCurrentDayAverageNeckAngleTextReport`
- POST `/weekly-averages` — `NeckAngleController.getWeeklyNeckAngleAverages` — body: filters

## User (`/api/v1/user`)

- GET `/response-rate` — `UserController.getResponseRate`
- GET `/usernames/exists` — `AuthController.usernameAlreadyExists` — query: `username`
- GET `/emails/validate` — `AuthController.isValidEmail` — query: `email`
- GET `/deletions/confirm` — `UserController.confirmDeleteMyAccount` — query: `token` or `id`
- GET `/fcm-token` — `UserController.getFCMTokenByUsername` — query: `username`
- GET `/` — `UserController.getByEmail` — query: `email`
- GET `/allow-push-notification` — auth+role `APP_USER` — `UserController.getAllowPushNotificationStatus`
- GET `/:id` — `UserController.fetch_user_profile`
- PUT `/` — auth+role `APP_USER` — `UserController.updateUser`
- PUT `/picture` — auth+role `APP_USER` — `UserController.updatePictureUrl` — body: `pictureUrl`
- PUT `/toggle-push-notification` — auth+role `APP_USER` — `UserController.toggleAllowPushNotifications`
- PUT `/fcm-token` — auth+role `APP_USER` — `UserController.updateFCMToken` — body: `fcmToken`
- POST `/logout` — auth+role `APP_USER` — `AuthController.logout`
- POST `/deletion-requests` — auth+role `APP_USER` — `UserController.deleteMyAccount`

## Transactions (`/api/v1/transaction`)

- GET `/` — auth+role `APP_USER` — `TransactionController.getTransactionRecordsByUserId`
- GET `/:id` — auth+role `APP_USER` — `TransactionController.getTransactionRecordById`
- POST `/` — auth+role `APP_USER` — `TransactionController.createTransactionRecord` — body: `purchaseToken, packageName, subscriptionId, amount, description`

## Legacy endpoints (mounted under `/api/v1` if enabled)

These routes exist in `src/routes/legacy.routes.ts`. If `app.use('/api/v1', legacyRoutes)` is enabled, the following legacy endpoints will be available (examples):

- POST `/user/login` — legacy login payloads accepted
- POST `/user/signup` — legacy signup payloads
- PUT `/user/updatefcmtoken`
- POST `/user/sendpasswordresettoken`
- PUT `/user/resetpassword`
- DELETE `/user/delete` — query `id` or `token`
- GET `/user` — query `email`
- GET `/user/getresponserate`
- POST `/user/postResponse`
- GET `/user/neckangleparameters`
- POST `/user/postneckanglerecords`
- POST `/goal/turnon`
- GET `/goal/getgoals`
- POST `/transaction`

---

If you want this converted into an OpenAPI (Swagger) YAML or JSON file for testing (Swagger UI/Postman), tell me and I will scaffold `docs/openapi.yaml`.
