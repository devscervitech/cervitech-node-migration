import { Router } from "express";
import BackOfficeUserController from "../controllers/backOfficeUser.controller";
import { authenticateJWT, authorizeRole } from "../middlewares/auth.middleware";

const router = Router();

/**
 * @openapi
 * /backoffice-users/signup:
 *   post:
 *     tags: [BackOfficeUser]
 *     summary: Create a back-office user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, password]
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       201:
 *         description: User created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiSuccessResponse'
 *       500:
 *         description: Failed to create user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 */
router.post("/signup", BackOfficeUserController.createUser);

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
 *             type: object
 *             required: [username, password]
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
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
 */
router.post("/login", BackOfficeUserController.loginController);

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
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: If the account exists, an OTP is sent
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
 */
router.post("/forgot-password", BackOfficeUserController.forgotPassword);

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
 *             type: object
 *             required: [email, otp]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               otp:
 *                 type: string
 *                 description: 6-digit code sent by email
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
 */
router.post("/verify-reset-otp", BackOfficeUserController.verifyResetOtp);

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
 *             type: object
 *             required: [token, newPassword]
 *             properties:
 *               token:
 *                 type: string
 *               newPassword:
 *                 type: string
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
 */
router.post("/reset-password", BackOfficeUserController.resetPassword);

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
 *             type: object
 *             required: [newPassword]
 *             properties:
 *               newPassword:
 *                 type: string
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
 *         description: User ID or new password missing
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
 */
router.get("/", authenticateJWT, authorizeRole('BACKOFFICE_USER'), BackOfficeUserController.getUsers);

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
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 */
router.delete("/:id", authenticateJWT, authorizeRole('BACKOFFICE_USER'), BackOfficeUserController.deleteUser);

/**
 * @openapi
 * /backoffice-users/{id}:
 *   put:
 *     tags: [BackOfficeUser]
 *     summary: Update a back-office user by ID
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
 *             type: object
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
 *         description: User ID missing
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
router.put("/:id", authenticateJWT, authorizeRole('BACKOFFICE_USER'), BackOfficeUserController.updateUser);

/**
 * @openapi
 * /backoffice-users/{id}:
 *   get:
 *     tags: [BackOfficeUser]
 *     summary: "[Dev] Get a back-office user by ID"
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
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 */
router.get("/:id", authenticateJWT, authorizeRole('BACKOFFICE_USER'), BackOfficeUserController.testUserById);

export default router;
