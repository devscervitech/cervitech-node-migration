# API Endpoints

Base URL: `/api/v1`

## Auth (`/api/v1/auth`)

- POST `/signup` — public — `AuthController.signup` — body: `username, email, password`
- PUT `/change-password` — auth required — `AuthController.changePassword` — body: `oldPassword, newPassword`
- POST `/request-reset` — public — `AuthController.sendPasswordToken` — body: `email` (sends a 6-digit OTP; returns `otp` in the response only when `OTP_DEBUG=true`)
- POST `/verify-reset-otp` — public — `AuthController.verifyResetOtp` — body: `email, otp` (returns `data.token`, a short-lived reset JWT)
- POST `/reset-password` — public — `AuthController.resetPassword` — body: `token, newPassword`
- POST `/login` — public — `AuthController.authenticate` — body: `emailOrUsername, password`
- POST `/logout` — auth required — `AuthController.logout`
- GET `/usernames/exists` — public — `AuthController.usernameAlreadyExists` — query: `username`
- GET `/validate-email` — public — `AuthController.isValidEmail` — query: `email`

## Backoffice Users (`/api/v1/backoffice-users`)

- POST `/signup` — public — `BackOfficeUserController.createUser` — body: user fields
- POST `/login` — public — `BackOfficeUserController.loginController` — body: credentials
- POST `/forgot-password` — public — `BackOfficeUserController.forgotPassword` — body: `email` (sends a 6-digit OTP)
- POST `/verify-reset-otp` — public — `BackOfficeUserController.verifyResetOtp` — body: `email, otp` (returns `data.token`)
- POST `/reset-password` — public — `BackOfficeUserController.resetPassword` — body: `token, newPassword`
- POST `/logout` — auth+role `BACKOFFICE_USER` — `BackOfficeUserController.logoutController`
- POST `/change-password` — auth+role `BACKOFFICE_USER` — `BackOfficeUserController.changePassword`
- GET `/` — auth+role `BACKOFFICE_USER` — `BackOfficeUserController.getUsers`
- DELETE `/:id` — auth+role `BACKOFFICE_USER` — `BackOfficeUserController.deleteUser`
- PUT `/:id` — auth+role `BACKOFFICE_USER` — `BackOfficeUserController.updateUser`
- GET `/:id` — auth+role `BACKOFFICE_USER` — `BackOfficeUserController.testUserById`

## Email (`/api/v1/email`)

- POST `/sign-up` — `EmailController.signup` — body: email template data
- POST `/password-reset` — `EmailController.passwordReset` — body: `to, username, code`
- POST `/account-deletion-request` — `EmailController.accountDeletionRequest`
- POST `/account-deletion` — `EmailController.accountDeletion`
- POST `/reminder` — `EmailController.reminder`

## FCM (`/api/v1/fcm`)

- PUT `/token` — auth required — `FCMController.updateFCMToken` — body: `fcmToken`

## Goals (`/api/v1/goals`)

- POST `/turn-on` — `GoalController.turnOnGoalByUserId` — body: `appUserId, targetedAverageNeckAngle`
- PUT `/turn-off` — `GoalController.turnOffGoalByUserId` — body: identifiers
- GET `/user-goals` — `GoalController.getGoalsByUserId` — query: `userid`
- GET `/neck-angle` — `GoalController.getCurrentTargetedAverageNeckAngle`

## Neck Angle (`/api/v1/neck-angle`)

- POST `/records/batch` — `NeckAngleController.postBatchNeckAngleRecords` — body: `records` array
- POST `/records/random` — `NeckAngleController.postRandomTestBatchNeckAngleRecords`
- GET `/stats` — auth required — `NeckAngleController.getUserNeckAngleStatistics`
- POST `/notification-count/reset` — auth required — `NeckAngleController.resetNotificationCount`
- GET `/test-users` — `NeckAngleController.getUsersForTesting`
- GET `/reports/current-day` — `NeckAngleController.getCurrentDayAverageNeckAngleTextReport`
- POST `/weekly-averages` — `NeckAngleController.getWeeklyNeckAngleAverages` — body: filters

## User (`/api/v1/user`)

- GET `/response-rate` — `UserController.getResponseRate`
- GET `/usernames/exists` — `AuthController.usernameAlreadyExists` — query: `username`
- GET `/emails/validate` — `AuthController.isValidEmail` — query: `email`
- GET `/deletions/confirm` — `UserController.confirmDeleteMyAccount` — query: `token` or `id`
- GET `/fcm-token` — `UserController.getFCMTokenByUsername` — query: `username`
- GET `/` — `UserController.getByEmail` — query: `email`
- GET `/allow-push-notification` — auth required — `UserController.getAllowPushNotificationStatus`
- GET `/:id` — `UserController.fetch_user_profile`
- PUT `/` — auth required — `UserController.updateUser`
- PUT `/picture` — auth required — `UserController.updatePictureUrl` — body: `pictureUrl`
- PUT `/toggle-push-notification` — auth required — `UserController.toggleAllowPushNotifications`
- PUT `/fcm-token` — auth required — `UserController.updateFCMToken` — body: `fcmToken`
- POST `/logout` — auth required — `AuthController.logout`
- POST `/deletion-requests` — auth required — `UserController.deleteMyAccount`

## Transactions (`/api/v1/transaction`)

- GET `/` — auth required — `TransactionController.getTransactionRecordsByUserId`
- GET `/:id` — auth required — `TransactionController.getTransactionRecordById`
- POST `/` — auth required — `TransactionController.createTransactionRecord` — body: `appUserId, paymentRef, amount, status, description`

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
