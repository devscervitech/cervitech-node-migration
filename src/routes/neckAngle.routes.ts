// routes/neckAngleRoutes.ts
import express from 'express';
import { NeckAngleController } from '../controllers/neckAngle.controller';

const router = express.Router();

router.post('/neckangle/postBatchNeckAngleRecords', NeckAngleController.postBatchNeckAngleRecords);
router.post('/neckangle/postrandomneckanglerecords', NeckAngleController.postRandomTestBatchNeckAngleRecords);

export default router;
