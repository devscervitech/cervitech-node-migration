// routes/neckAngleRoutes.ts
import express from 'express';
import { NeckAngleController } from '../controllers/neckAngle.controller';
import { authenticateJWT, authorizeRole } from '../middlewares/auth.middleware.js';

const router = express.Router();

//// router.post('/neckangle/sendPushNotificationMessageForAverageNeckAngle', NeckAngleController.sendPushNotificationMessageForAverageNeckAngle);
// //the sendPushNotificationMessageForAverageNeckAngle was commented out in neck angle controller

/**
 * @openapi
 * /neck-angle/records/batch:
 *   post:
 *     tags: [NeckAngle]
 *     summary: Submit neck-angle records for the authenticated app user; body appUserId is ignored
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [neckAngleRecords]
 *             properties:
 *               neckAngleRecords:
 *                 type: array
 *                 items:
 *                   type: object
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Account role not permitted
 *       200:
 *         description: Records saved
 *       400:
 *         description: neckAngleRecords missing/invalid
 */
router.post('/records/batch', authenticateJWT, authorizeRole('APP_USER'), NeckAngleController.postBatchNeckAngleRecords);



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
 */
router.get('/stats', authenticateJWT, NeckAngleController.getUserNeckAngleStatistics);

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
 */
router.post(
  '/notification-count/reset',
  authenticateJWT,
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
 *     description: Uses Monday-start UTC calendar weeks, including a sixth partial week when present.
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
 */
router.get('/weekly-chart', authenticateJWT, NeckAngleController.getWeeklyChartData);

export default router;
