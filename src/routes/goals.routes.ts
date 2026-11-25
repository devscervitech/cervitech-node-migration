// goals.routes.ts
import { Router } from 'express';
import { GoalController } from '../controllers/goal.controller';
import { authenticateJWT, authorizeRole } from '../middlewares/auth.middleware';

const router = Router();

/**
 * @openapi
 * /goals/turn-on:
 *   post:
 *     tags: [Goals]
 *     summary: Turn on a neck-angle goal for the authenticated user
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/GoalTurnOnRequest'
 *     responses:
 *       201:
 *         description: Goal turned on
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid target or unsupported frequency
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Authenticated app-user token required
 */
router.post('/turn-on', authenticateJWT, authorizeRole('APP_USER'), GoalController.turnOnGoalByUserId);

/**
 * @openapi
 * /goals/turn-off:
 *   put:
 *     tags: [Goals]
 *     summary: Turn off the authenticated user's active goal
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [targetedAverageNeckAngle]
 *             properties:
 *               targetedAverageNeckAngle:
 *                 type: number
 *     responses:
 *       200:
 *         description: Goal turned off
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Missing/invalid goal data, or failed to turn off
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Authenticated app-user token required
 */
router.put('/turn-off', authenticateJWT, authorizeRole('APP_USER'), GoalController.turnOffGoalByUserId);

/**
 * @openapi
 * /goals/user-goals:
 *   get:
 *     tags: [Goals]
 *     summary: List the authenticated user's goals
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Server-computed goal-cycle reports, or an empty array when no reports exist
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       appUserId:
 *                         type: string
 *                       frequency:
 *                         type: string
 *                       targetedAverageNeckAngle:
 *                         type: number
 *                       actualAverageNeckAngle:
 *                         type: number
 *                       complianceInPercentage:
 *                         type: number
 *                       dateOfConcludedCycle:
 *                         type: string
 *                       dayOfConcludedCycle:
 *                         type: string
 *                       colorTag:
 *                         type: string
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Authenticated app-user token required
 */
router.get('/user-goals', authenticateJWT, authorizeRole('APP_USER'), GoalController.getGoalsByUserId);

/**
 * @openapi
 * /goals/neck-angle:
 *   get:
 *     tags: [Goals]
 *     summary: Get the authenticated user's currently targeted average neck angle
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Targeted average neck angle, or zero when no goal exists
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: number
 *       400:
 *         description: Not authenticated
 *       403:
 *         description: Authenticated app-user token required
 */
router.get('/neck-angle', authenticateJWT, authorizeRole('APP_USER'), GoalController.getCurrentTargetedAverageNeckAngle);

export default router;
