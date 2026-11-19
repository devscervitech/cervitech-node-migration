// src/routes/fcm.routes.ts
import { Router } from 'express';
import { UserController } from '../controllers/user.controller';
import { authenticateJWT, authorizeRole } from '../middlewares/auth.middleware';
import { deprecatedRoute } from '../middlewares/deprecatedRoute';

const router = Router();

/**
 * @openapi
 * /fcm/token:
 *   put:
 *     tags: [FCM]
 *     summary: Update the authenticated user's FCM push token
 *     deprecated: true
 *     description: Deprecated. Use `PUT /users/me/fcm-token` instead.
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
 *         description: fcmToken missing
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Authenticated app-user token required
 */
router.put(
  '/token',
  deprecatedRoute('/users/me/fcm-token'),
  authenticateJWT,
  authorizeRole('APP_USER'),
  UserController.updateFCMToken
);

export default router;
