import { Router } from "express";
import BackOfficeUserController from "../controllers/backOfficeUser.controller";
import {
  authenticateJWT,
  authorizeRole,
  requireAccessLevel,
  requireWritable,
} from "../middlewares/auth.middleware";
import { authRateLimit } from "../middlewares/authRateLimit.middleware";

const router = Router();
const backofficeLoginRateLimit = authRateLimit('backoffice-login', 10, 15 * 60 * 1000);
const backofficeResetRequestRateLimit = authRateLimit('backoffice-reset-request', 5, 15 * 60 * 1000);
const backofficeResetVerifyRateLimit = authRateLimit('backoffice-reset-verify', 10, 15 * 60 * 1000);
const backofficeResetPasswordRateLimit = authRateLimit('backoffice-reset-password', 10, 15 * 60 * 1000);

/**
 * @openapi
 * /backoffice-users/signup:
 *   post:
 *     tags: [BackOfficeUser]
 *     summary: Create a back-office user (administrator only)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateBackofficeUserRequest'
 *     responses:
 *       201:
 *         description: User created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiSuccessResponse'
 *       400:
 *         description: Invalid user fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *       500:
 *         description: Failed to create user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *       403:
 *         description: Administrator privileges required or account is read-only
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *       409:
 *         description: Another account security mutation is in progress
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 */
router.post(
  "/signup",
  authenticateJWT,
  authorizeRole('BACKOFFICE_USER'),
  requireAccessLevel('ADMIN'),
  requireWritable,
  BackOfficeUserController.createUser
);

/**
 * @openapi
 * /backoffice-users/login:
 *   post:
 *     tags: [BackOfficeUser]
 *     summary: Authenticate a back-office user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BackofficeLoginRequest'
 *     responses:
 *       200:
 *         description: Authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiSuccessResponse'
 *       400:
 *         description: Username or password missing
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *       429:
 *         description: Login request limit exceeded
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 */
router.post("/login", backofficeLoginRateLimit, BackOfficeUserController.loginController);

/**
 * @openapi
 * /backoffice-users/forgot-password:
 *   post:
 *     tags: [BackOfficeUser]
 *     summary: Send a password reset OTP to a back-office user's email
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BackofficeForgotPasswordRequest'
 *     responses:
 *       200:
 *         description: Generic response whether or not the account exists; OTP is never included
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiSuccessResponse'
 *       400:
 *         description: Email missing
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *       429:
 *         description: Password-reset request limit exceeded
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 */
router.post("/forgot-password", backofficeResetRequestRateLimit, BackOfficeUserController.forgotPassword);

/**
 * @openapi
 * /backoffice-users/verify-reset-otp:
 *   post:
 *     tags: [BackOfficeUser]
 *     summary: Verify a back-office user's password reset OTP and receive a reset token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BackofficeVerifyResetOtpRequest'
 *     responses:
 *       200:
 *         description: OTP verified; data contains a short-lived reset token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiSuccessResponse'
 *       400:
 *         description: Invalid or expired OTP, or fields missing
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *       429:
 *         description: OTP verification limit exceeded
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 */
router.post("/verify-reset-otp", backofficeResetVerifyRateLimit, BackOfficeUserController.verifyResetOtp);

/**
 * @openapi
 * /backoffice-users/reset-password:
 *   post:
 *     tags: [BackOfficeUser]
 *     summary: Reset a back-office user's password using a reset token
 *     description: Requires a password_reset token scoped to BACKOFFICE_USER; tokens from other account types are rejected.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BackofficeResetPasswordRequest'
 *     responses:
 *       200:
 *         description: Password reset
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiSuccessResponse'
 *       400:
 *         description: Token or new password missing
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *       429:
 *         description: Password-reset attempt limit exceeded
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 */
router.post("/reset-password", backofficeResetPasswordRateLimit, BackOfficeUserController.resetPassword);

/**
 * @openapi
 * /backoffice-users/logout:
 *   post:
 *     tags: [BackOfficeUser]
 *     summary: Log out the authenticated back-office user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       503:
 *         description: Authentication storage temporarily unavailable
 *       200:
 *         description: Logged out
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiSuccessResponse'
 *       400:
 *         description: Authorization token missing
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 */
router.post("/logout", authenticateJWT, authorizeRole('BACKOFFICE_USER'), BackOfficeUserController.logoutController);

/**
 * @openapi
 * /backoffice-users/change-password:
 *   post:
 *     tags: [BackOfficeUser]
 *     summary: Change the authenticated back-office user's password
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BackofficeChangePasswordRequest'
 *     responses:
 *       503:
 *         description: Authentication storage temporarily unavailable
 *       200:
 *         description: Password changed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiSuccessResponse'
 *       400:
 *         description: Invalid password fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *       401:
 *         description: Not authenticated or current password is incorrect
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 */
router.post("/change-password", authenticateJWT, authorizeRole('BACKOFFICE_USER'), BackOfficeUserController.changePassword);

/**
 * @openapi
 * /backoffice-users:
 *   get:
 *     tags: [BackOfficeUser]
 *     summary: List back-office users
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         required: false
 *         description: If provided, returns only this many users
 *         schema:
 *           type: integer
 *     responses:
 *       503:
 *         description: Authentication storage temporarily unavailable
 *       200:
 *         description: Users retrieved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiSuccessResponse'
 *       400:
 *         description: Limit invalid
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *       403:
 *         description: Administrator privileges required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 */
router.get(
  "/",
  authenticateJWT,
  authorizeRole('BACKOFFICE_USER'),
  requireAccessLevel('ADMIN'),
  BackOfficeUserController.getUsers
);

/**
 * @openapi
 * /backoffice-users/{id}:
 *   delete:
 *     tags: [BackOfficeUser]
 *     summary: Delete a back-office user by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       503:
 *         description: Authentication storage temporarily unavailable
 *       200:
 *         description: User deleted
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiSuccessResponse'
 *       400:
 *         description: Invalid user ID
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *       403:
 *         description: Administrator privileges required, account is read-only, or self-deletion attempted
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *       409:
 *         description: Deletion would remove the last active administrator or another account security change is in progress
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 */
router.delete(
  "/:id",
  authenticateJWT,
  authorizeRole('BACKOFFICE_USER'),
  requireAccessLevel('ADMIN'),
  requireWritable,
  BackOfficeUserController.deleteUser
);

/**
 * @openapi
 * /backoffice-users/{id}:
 *   put:
 *     tags: [BackOfficeUser]
 *     summary: Update a back-office user profile (administrator only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateBackofficeProfileRequest'
 *     responses:
 *       503:
 *         description: Authentication storage temporarily unavailable
 *       200:
 *         description: User updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiSuccessResponse'
 *       400:
 *         description: Invalid user ID or profile fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *       403:
 *         description: Administrator privileges required or account is read-only
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 */
router.put(
  "/:id",
  authenticateJWT,
  authorizeRole('BACKOFFICE_USER'),
  requireAccessLevel('ADMIN'),
  requireWritable,
  BackOfficeUserController.updateUser
);

/**
 * @openapi
 * /backoffice-users/{id}/access:
 *   put:
 *     tags: [BackOfficeUser]
 *     summary: Update another back-office user's access level or read-only setting
 *     description: Only administrators may change another user's access level. A writable administrator cannot change their own access settings or remove the last active administrator.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateBackofficeAccessRequest'
 *     responses:
 *       200:
 *         description: Access metadata updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiSuccessResponse'
 *       400:
 *         description: Invalid request body or user ID
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *       403:
 *         description: Administrator privileges required, account is read-only, or self-modification attempted
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *       409:
 *         description: Update would remove the last active administrator or another account security change is in progress
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 */
router.put(
  "/:id/access",
  authenticateJWT,
  authorizeRole('BACKOFFICE_USER'),
  requireAccessLevel('ADMIN'),
  requireWritable,
  BackOfficeUserController.updateAccess
);

/**
 * @openapi
 * /backoffice-users/{id}:
 *   get:
 *     tags: [BackOfficeUser]
 *     summary: Get a back-office user by ID (administrator only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       503:
 *         description: Authentication storage temporarily unavailable
 *       200:
 *         description: User found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiSuccessResponse'
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *       403:
 *         description: Administrator privileges required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 */
router.get(
  "/:id",
  authenticateJWT,
  authorizeRole('BACKOFFICE_USER'),
  requireAccessLevel('ADMIN'),
  BackOfficeUserController.testUserById
);

export default router;
