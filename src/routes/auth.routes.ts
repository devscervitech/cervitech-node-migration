// src/routes/auth.routes.ts
import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller.js';
import { authenticateJWT, authorizeRole } from '../middlewares/auth.middleware.js';
import { authRateLimit } from '../middlewares/authRateLimit.middleware';

const router = Router();
const signupRateLimit = authRateLimit('app-signup', 5, 60 * 60 * 1000);
const loginRateLimit = authRateLimit('app-login', 10, 15 * 60 * 1000);
const resetRequestRateLimit = authRateLimit('app-reset-request', 5, 15 * 60 * 1000);
const resetVerifyRateLimit = authRateLimit('app-reset-verify', 10, 15 * 60 * 1000);
const resetPasswordRateLimit = authRateLimit('app-reset-password', 10, 15 * 60 * 1000);
const usernameCheckRateLimit = authRateLimit('app-username-check', 60, 15 * 60 * 1000);
const emailCheckRateLimit = authRateLimit('app-email-check', 30, 15 * 60 * 1000);

/**
 * @openapi
 * /auth/signup:
 *   post:
 *     tags: [Auth]
 *     summary: Create a new account
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SignupRequest'
 *     responses:
 *       201:
 *         description: Account created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiSuccessResponse'
 *       400:
 *         description: Validation failed or account already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *       429:
 *         description: Signup request limit exceeded; retry after the indicated interval
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 */
router.post('/signup', signupRateLimit, AuthController.signup);

/**
 * @openapi
 * /auth/change-password:
 *   put:
 *     tags: [Auth]
 *     summary: Change the authenticated user's password
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AppUserChangePasswordRequest'
 *     responses:
 *       503:
 *         description: Authentication storage temporarily unavailable
 *       200:
 *         description: Password changed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiSuccessResponse'
 *       401:
 *         description: Not authenticated, or former password incorrect
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *       403:
 *         description: Authenticated app-user token required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 */
router.put('/change-password', authenticateJWT, authorizeRole('APP_USER'), AuthController.changePassword);

/**
 * @openapi
 * /auth/request-reset:
 *   post:
 *     tags: [Auth]
 *     summary: Send a password reset OTP to the given email
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AppUserResetRequest'
 *     responses:
 *       200:
 *         description: If the account exists, an OTP is sent
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiSuccessResponse'
 *       400:
 *         description: Email is malformed or missing
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
router.post('/request-reset', resetRequestRateLimit, AuthController.sendPasswordToken);

/**
 * @openapi
 * /auth/verify-reset-otp:
 *   post:
 *     tags: [Auth]
 *     summary: Verify a password reset OTP and receive a reset token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AppUserVerifyResetOtpRequest'
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
router.post('/verify-reset-otp', resetVerifyRateLimit, AuthController.verifyResetOtp);

/**
 * @openapi
 * /auth/reset-password:
 *   post:
 *     tags: [Auth]
 *     summary: Reset a password using a reset token
 *     description: Requires a password_reset token scoped to APP_USER; tokens from other account types are rejected.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AppUserResetPasswordRequest'
 *     responses:
 *       200:
 *         description: Password reset
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiSuccessResponse'
 *       400:
 *         description: Token invalid, expired, or password missing
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
router.post('/reset-password', resetPasswordRateLimit, AuthController.resetPassword);

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Authenticate with email/username and password
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiSuccessResponse'
 *       400:
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
router.post('/login', loginRateLimit, AuthController.authenticate);

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Log out and blacklist the current token
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
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *       403:
 *         description: Authenticated app-user token required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 */
router.post('/logout', authenticateJWT, authorizeRole('APP_USER'), AuthController.logout);

/**
 * @openapi
 * /auth/usernames/exists:
 *   get:
 *     tags: [Auth]
 *     summary: Check whether a username is already taken
 *     parameters:
 *       - in: query
 *         name: username
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 3
 *           maxLength: 50
 *           pattern: '^[a-zA-Z0-9]+$'
 *     responses:
 *       200:
 *         description: Whether the username exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiSuccessResponse'
 *       400:
 *         description: Username is malformed or missing
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *       429:
 *         description: Username lookup limit exceeded
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 */
router.get("/usernames/exists", usernameCheckRateLimit, AuthController.usernameAlreadyExists);

/**
 * @openapi
 * /auth/validate-email:
 *   get:
 *     tags: [Auth]
 *     summary: Check whether an email address is valid/deliverable
 *     parameters:
 *       - in: query
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *           format: email
 *     responses:
 *       200:
 *         description: Whether the email is valid
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiSuccessResponse'
 *       400:
 *         description: Email is malformed or missing
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *       429:
 *         description: Email validation limit exceeded
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 */
router.get("/validate-email", emailCheckRateLimit, AuthController.isValidEmail)

export default router;
