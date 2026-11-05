// routes/neckAngleRoutes.ts
import express from 'express';
import { postRandomTestBatchNeckAngleRecords, postBatchNeckAngleRecords, } from '../controllers/neckAngle.controller';
const router = express.Router();
router.post('/neckangle/postBatchNeckAngleRecords', postBatchNeckAngleRecords);
router.post('/neckangle/postrandomneckanglerecords', postRandomTestBatchNeckAngleRecords);
export default router;
