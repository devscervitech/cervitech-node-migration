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
 *     summary: Submit a bounded batch of neck-angle records for the authenticated app user
 *     description: Any appUserId supplied in the request body is ignored; records are scoped to the authenticated app user.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/NeckAngleBatchRequest'
 *     responses:
 *       200:
 *         description: Records saved
 *       400:
 *         description: Request body invalid or batch exceeds 100 records
 *       413:
 *         description: JSON request body exceeds the 100 KB parser limit
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Authenticated app-user token required
 *     security:
 *       - bearerAuth: []
 */
router.post('/records/batch', authenticateJWT, authorizeRole('APP_USER'), NeckAngleController.postBatchNeckAngleRecords);


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
 *             $ref: '#/components/schemas/RandomNeckAngleBatchRequest'
 *     responses:
 *       200:
 *         description: Records saved
 *       400:
 *         description: Invalid user ID, record count, or date range
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
 *     description: responseRate is the all-time responses-to-prompts percentage; posture angles do not modify it.
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
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Account role not permitted
 *       200:
 *         description: Report generated
 *       400:
 *         description: neckAngle query param missing or not numeric
 */
router.get('/reports/current-day', authenticateJWT, NeckAngleController.getCurrentDayAverageNeckAngleTextReport);

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
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Account role not permitted
 *       200:
 *         description: Weekly averages computed
 *       400:
 *         description: records missing or not an array
 */
router.post('/weekly-averages', authenticateJWT, NeckAngleController.getWeeklyNeckAngleAverages);

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
