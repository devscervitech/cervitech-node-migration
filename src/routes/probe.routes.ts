// src/routes/probe.routes.ts
// Unversioned liveness probe for the Docker HEALTHCHECK, mounted at the application root.
import { Router } from 'express';
import { sendSuccess } from '../utils/apiResponse';

const router = Router();

/**
 * @openapi
 * /health:
 *   servers:
 *     - url: /
 *   get:
 *     tags: [Health]
 *     summary: Liveness probe (no auth)
 *     description: Returns 200 whenever the process is serving HTTP. It does
 *       not check dependencies, so a database outage alone does not mark the
 *       container unhealthy. The Docker HEALTHCHECK uses this endpoint.
 *     security: []
 *     responses:
 *       200:
 *         description: Process is live
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiSuccessResponse'
 */
router.get('/health', (_req, res) => {
  sendSuccess(res, { status: 'ok' }, 'Service is live');
});

export default router;
