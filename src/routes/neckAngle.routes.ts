// routes/neckAngleRoutes.ts
import express from 'express';
import { NeckAngleController } from '../controllers/neckAngle.controller';
import {
  authenticateJWT,
  authorizeRole,
  requireAccessLevel,
  requireWritable,
} from '../middlewares/auth.middleware.js';

const router = express.Router();

//// router.post('/neckangle/sendPushNotificationMessageForAverageNeckAngle', NeckAngleController.sendPushNotificationMessageForAverageNeckAngle);
// //the sendPushNotificationMessageForAverageNeckAngle was commented out in neck angle controller

/**
 * @openapi
 * /neck-angle/records/batch:
 *   post:
 *     tags: [NeckAngle]
 *     summary: Submit a batch of neck-angle records for a user
 *     description: Records are always stored for the authenticated app user. Any appUserId supplied in the request body is ignored.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [neckAngleRecords]
 *             properties:
 *               appUserId:
 *                 type: string
 *                 deprecated: true
 *                 description: Ignored; record ownership comes from the authenticated token.
 *               neckAngleRecords:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       200:
 *         description: Records saved
 *       400:
 *         description: neckAngleRecords missing/invalid
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Authenticated app-user token required
 */
router.post(
  '/records/batch',
  authenticateJWT,
  authorizeRole('APP_USER'),
  NeckAngleController.postBatchNeckAngleRecords
);

/**
 * @openapi
 * /neck-angle/records/random:
 *   post:
 *     tags: [NeckAngle]
 *     summary: "[Dev] Submit a batch of randomly generated test neck-angle records"
 *     description: Administrator only. This endpoint modifies the selected app user's test records.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [appUserId, testValues]
 *             properties:
 *               appUserId:
 *                 type: string
 *               testValues:
 *                 type: array
 *                 items:
 *                   type: number
 *     responses:
 *       200:
 *         description: Records saved
 *       400:
 *         description: appUserId or testValues missing/invalid
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Administrator privileges required or account is read-only
 */
router.post(
  '/records/random',
  authenticateJWT,
  authorizeRole('BACKOFFICE_USER'),
  requireAccessLevel('ADMIN'),
  requireWritable,
  NeckAngleController.postRandomTestBatchNeckAngleRecords
);

/**
 * @openapi
 * /neck-angle/stats:
 *   get:
 *     tags: [NeckAngle]
 *     summary: Get the authenticated user's computed neck-angle statistics
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Statistics computed
 *       400:
 *         description: Failed to compute statistics
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Authenticated app-user token required
 */
router.get('/stats', authenticateJWT, authorizeRole('APP_USER'), NeckAngleController.getUserNeckAngleStatistics);

/**
 * @openapi
 * /neck-angle/notification-count/reset:
 *   post:
 *     tags: [NeckAngle]
 *     summary: Reset the authenticated user's notification count
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Notification count reset
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Authenticated app-user token required
 */
router.post(
  '/notification-count/reset',
  authenticateJWT,
  authorizeRole('APP_USER'),
  NeckAngleController.resetNotificationCount
);

/**
 * @openapi
 * /neck-angle/test-users:
 *   get:
 *     tags: [NeckAngle]
 *     summary: "[Dev] List up to 10 app users for testing"
 *     description: Administrator only. The response includes usernames, email addresses, and FCM tokens.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Users retrieved
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Administrator privileges required
 */
router.get(
  '/test-users',
  authenticateJWT,
  authorizeRole('BACKOFFICE_USER'),
  requireAccessLevel('ADMIN'),
  NeckAngleController.getUsersForTesting
);

/**
 * @openapi
 * /neck-angle/reports/current-day:
 *   get:
 *     tags: [NeckAngle]
 *     summary: Generate a text report for a given neck angle value
 *     parameters:
 *       - in: query
 *         name: neckAngle
 *         required: true
 *         schema:
 *           type: number
 *     responses:
 *       200:
 *         description: Report generated
 *       400:
 *         description: neckAngle query param missing or not numeric
 */
router.get('/reports/current-day', NeckAngleController.getCurrentDayAverageNeckAngleTextReport);

/**
 * @openapi
 * /neck-angle/weekly-averages:
 *   post:
 *     tags: [NeckAngle]
 *     summary: Compute each week-of-month's average neck angle from raw records
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [records]
 *             properties:
 *               records:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     dateTimeRecorded:
 *                       type: string
 *                       format: date-time
 *     responses:
 *       200:
 *         description: Weekly averages computed
 *       400:
 *         description: records missing or not an array
 */
router.post('/weekly-averages', NeckAngleController.getWeeklyNeckAngleAverages);

/**
 * @openapi
 * /neck-angle/weekly-chart:
 *   get:
 *     tags: [NeckAngle]
 *     summary: Get the authenticated user's weekly neck-angle chart data
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Chart data retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   additionalProperties:
 *                     type: number
 *                   example:
 *                     Sunday: 42.5
 *                     Monday: 0
 *                     Tuesday: 55
 *                     Wednesday: 48.2
 *                     Thursday: 0
 *                     Friday: 61.7
 *                     Saturday: 0
 *       400:
 *         description: Failed to compute chart data
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Authenticated app-user token required
 */
router.get('/weekly-chart', authenticateJWT, authorizeRole('APP_USER'), NeckAngleController.getWeeklyChartData);

export default router;
