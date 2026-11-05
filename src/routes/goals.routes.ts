// goals.routes.ts
import { Router } from 'express';
import { GoalController } from '../controllers/goal.controller';

const router = Router();

router.post('/turn-on', GoalController.turnOnGoalByUserId);
router.put('/turn-off', GoalController.turnOffGoalByUserId);
router.get('/user-goals', GoalController.getGoalsByUserId);
router.get('/neck-angle', GoalController.getCurrentTargetedAverageNeckAngle);

export default router;
