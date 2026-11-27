// src/routes/users.routes.ts
import { Router } from 'express';
import { UserController } from '../controllers/user.controller';
import {
  authenticateJWT,
  authorizeRole,
  requireAccessLevel,
  requireWritable,
} from '../middlewares/auth.middleware';

const router = Router();

// -------------------------
// Public lookups
// -------------------------

/**
 * @openapi
 * /users:
 *   get:
 *     tags: [User]
 *     summary: "[Back office] Get a user by email"
 *     parameters:
 *       - in: query
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *           format: email
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Account role not permitted
 *       200:
 *         description: User found
 *       400:
 *         description: Email missing
 *       404:
 *         description: User not found
 */
router.get('/', authenticateJWT, authorizeRole('BACKOFFICE_USER'), UserController.getByEmail);

/**
 * @openapi
 * /users/response-rate:
 *   get:
 *     tags: [User]
 *     description: Day boundaries and hourly buckets use UTC.
 *     summary: "[Back office] Get a user's response rate for a given date"
 *     parameters:
 *       - in: query
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Account role not permitted
 *       200:
 *         description: Response rate computed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiSuccessResponse'
 *       400:
 *         description: Missing/invalid id or date
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 */
router.get('/response-rate', authenticateJWT, authorizeRole('BACKOFFICE_USER'), UserController.getResponseRate);



// ---------------------------------------------------------------------------
// ORDERING IS LOAD-BEARING: every literal /users/<word> route must be
// registered ABOVE the `/:id` route below.
//
// Express matches in registration order and `/:id` matches any single path
// segment, so `/:id` will swallow `/users/me` if it is registered first --
// the handler becomes dead code and the caller gets the back-office guard's
// "Access denied. Only BACKOFFICE_USERs are allowed." instead. That is
// exactly what GET /users/me did before this route existed, and it is why
// the mobile client concluded the whole /users surface was back-office only.
//
// The two-segment /me/... routes further down are not affected, which is why
// this went unnoticed. A regex constraint on `/:id` would be the sturdier
// fix, but path-to-regexp 8 (Express 5) removed custom match patterns, so
// `'/:id([0-9a-fA-F]{24})'` throws at startup. Ordering is the only tool.
// ---------------------------------------------------------------------------

/**
 * @openapi
 * /users/me:
 *   get:
 *     tags: [User]
 *     summary: Get the authenticated user's own profile
 *     description: >
 *       Returns the caller's own record, including `hasPaid`. The account is
 *       taken from the bearer token, so there is no path or query parameter.
 *       The payload matches the login response's `data` object minus `token`,
 *       letting a client refresh session state without signing out and in.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile retrieved
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/AppUserProfile'
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
 *       404:
 *         description: Account not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 */
router.get('/me', authenticateJWT, authorizeRole('APP_USER'), UserController.getMe);

/**
 * @openapi
 * /users/{id}:
 *   get:
 *     tags: [User]
 *     summary: "[Back office] Get a user profile by ID"
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Account role not permitted
 *       200:
 *         description: User found
 *       400:
 *         description: Id missing
 *       404:
 *         description: User not found
 */
router.get('/:id', authenticateJWT, authorizeRole('BACKOFFICE_USER'), UserController.fetch_user_profile);

// -------------------------
// Back office (admin)
// -------------------------

/**
 * @openapi
 * /users/{id}:
 *   delete:
 *     tags: [User]
 *     summary: "[Back office] Delete an app user's account by ID"
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User deleted
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
router.delete(
  '/:id',
  authenticateJWT,
  authorizeRole('BACKOFFICE_USER'),
  requireAccessLevel('ADMIN'),
  requireWritable,
  UserController.deleteById
);

// -------------------------
// Authenticated self-service ("me")
// -------------------------

/**
 * @openapi
 * /users/me:
 *   put:
 *     tags: [User]
 *     summary: Update the authenticated user's profile
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               username:
 *                 type: string
 *               telephone:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiSuccessResponse'
 *       400:
 *         description: User ID missing, or update failed
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
router.put('/me', authenticateJWT, authorizeRole('APP_USER'), UserController.updateUser);

/**
 * @openapi
 * /users/me/picture:
 *   put:
 *     tags: [User]
 *     summary: Update the authenticated user's profile picture
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [pictureUrl]
 *             properties:
 *               pictureUrl:
 *                 type: string
 *                 format: uri
 *     responses:
 *       200:
 *         description: Picture updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiSuccessResponse'
 *       400:
 *         description: User ID or picture URL missing
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *       404:
 *         description: User not found
 *       403:
 *         description: Authenticated app-user token required
 */
router.put('/me/picture', authenticateJWT, authorizeRole('APP_USER'), UserController.updatePictureUrl);

/**
 * @openapi
 * /users/me/allow-push-notification:
 *   get:
 *     tags: [User]
 *     summary: Get the authenticated user's push-notification preference
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Preference retrieved
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Authenticated app-user token required
 *       404:
 *         description: User not found
 */
router.get(
  '/me/allow-push-notification',
  authenticateJWT,
  authorizeRole('APP_USER'),
  UserController.getAllowPushNotificationStatus
);

/**
 * @openapi
 * /users/me/toggle-push-notification:
 *   put:
 *     tags: [User]
 *     summary: Toggle the authenticated user's push-notification preference
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Preference toggled
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
 *       403:
 *         description: Authenticated app-user token required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 */
router.put(
  '/me/toggle-push-notification',
  authenticateJWT,
  authorizeRole('APP_USER'),
  UserController.toggleAllowPushNotifications
);

/**
 * @openapi
 * /users/me/fcm-token:
 *   put:
 *     tags: [User]
 *     summary: Update the authenticated user's FCM token
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fcmToken]
 *             properties:
 *               fcmToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiSuccessResponse'
 *       400:
 *         description: fcmToken missing/invalid
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Authenticated app-user token required
 */
router.put('/me/fcm-token', authenticateJWT, authorizeRole('APP_USER'), UserController.updateFCMToken);

/**
 * @openapi
 * /users/me/deletion-requests:
 *   post:
 *     tags: [User]
 *     summary: Request deletion of the authenticated user's account
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Deletion request submitted
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
 *       404:
 *         description: Account not found
 *       403:
 *         description: Authenticated app-user token required
 */
router.post('/me/deletion-requests', authenticateJWT, authorizeRole('APP_USER'), UserController.deleteMyAccount);

/**
 * @openapi
 * /users/me/deletion-requests/{token}:
 *   get:
 *     tags: [User]
 *     summary: Check whether an account-deletion token is valid/pending (does not delete)
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Token is valid and deletion is pending confirmation
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiSuccessResponse'
 *       400:
 *         description: Token missing, already used, invalid, or not an account-deletion token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 */
router.get('/me/deletion-requests/:token', UserController.checkDeletionRequest);

/**
 * @openapi
 * /users/me/deletion-requests/{token}:
 *   delete:
 *     tags: [User]
 *     summary: Confirm account deletion using a token (e.g. from an email link)
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Account deleted
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiSuccessResponse'
 *       400:
 *         description: Token missing, already used, invalid, or not an account-deletion token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *       404:
 *         description: Account not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 */
router.delete('/me/deletion-requests/:token', UserController.confirmDeleteMyAccount);

export default router;
