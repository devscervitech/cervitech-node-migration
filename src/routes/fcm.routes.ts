// src/routes/fcm.routes.ts
import { Router } from 'express';
import { FCMController } from '../controllers/fcmToken.controller';
import { UserController } from '../controllers/user.controller';
import { authenticateJWT } from '../middlewares/auth.middleware';
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
 */
router.put('/token', deprecatedRoute('/users/me/fcm-token'), authenticateJWT, UserController.updateFCMToken);

// Test/dev endpoints (no auth)

/**
 * @openapi
 * /fcm/test-push:
 *   get:
 *     tags: [FCM]
 *     summary: "[Dev] Send a test push notification to a token"
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Push sent
 *       400:
 *         description: token query param missing
 */
router.get('/test-push', FCMController.testPush);

/**
 * @openapi
 * /fcm/test-scheduler:
 *   post:
 *     tags: [FCM]
 *     summary: "[Dev] Start a cron job that repeatedly pushes to a token"
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: cron
 *         required: false
 *         description: Cron expression, defaults to every minute
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Scheduler started
 *       400:
 *         description: token query param missing
 */
router.post('/test-scheduler', FCMController.testScheduler);

/**
 * @openapi
 * /fcm/stop-scheduler:
 *   post:
 *     tags: [FCM]
 *     summary: "[Dev] Stop all test-push scheduled jobs"
 *     responses:
 *       200:
 *         description: Schedulers stopped
 */
router.post('/stop-scheduler', FCMController.stopScheduler);

export default router;
