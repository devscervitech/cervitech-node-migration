// src/routes/health.routes.ts
import { Router } from 'express';
import { HealthController } from '../controllers/health.controller';

const router = Router();

/**
 * @openapi
 * /health/push:
 *   get:
 *     tags: [Health]
 *     summary: Push delivery health summary (no auth)
 *     description: Counts of push notifications per delivery status and the
 *       most recent confirmed delivery failures. Device tokens are excluded.
 *     responses:
 *       200:
 *         description: Push health retrieved
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
 *                   properties:
 *                     total:
 *                       type: number
 *                     delivered:
 *                       type: number
 *                     pending:
 *                       type: number
 *                     failed:
 *                       type: number
 *                     recentFailures:
 *                       type: array
 *                       items:
 *                         type: object
 *       500:
 *         description: Failed to compute push health
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 */
router.get('/push', HealthController.getPushHealth);

export default router;
