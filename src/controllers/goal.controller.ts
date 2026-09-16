import { Request, Response } from 'express';
import { GoalService } from '../services/goal.service';
import { SetGoalViewModel, TurnOnGoalViewModel } from '../types/goal.types';
import { logger } from '../utils/logger';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { CustomException } from '../utils/customException';

export class GoalController {
  static async turnOnGoalByUserId(req: AuthenticatedRequest, res: Response): Promise<void> {
    const model: SetGoalViewModel = req.body;
    const appUserId = req.user?.userId;

    if (!appUserId) {
      logger.warn('turn-on goal rejected: missing user ID in token', {
        username: req.user?.username,
        email: req.user?.email,
      });
      res.status(401).json({ error: 'Unauthorized: User ID is missing.' });
      return;
    }

    if (!model || typeof model.targetedAverageNeckAngle !== 'number' || !model.frequency) {
      logger.warn('turn-on goal rejected: invalid or incomplete request body', {
        userId: appUserId,
        targetedAverageNeckAngle: model?.targetedAverageNeckAngle,
        frequency: model?.frequency,
        hasGoalCycleCompletionReports: Array.isArray(model?.goalCycleCompletionReports),
      });
      res.status(400).json({
        error: 'Goal data with valid user ID is required (targetedAverageNeckAngle and frequency).',
      });
      return;
    }

    try {
      const result = await GoalService.turnOnGoalAsync(appUserId, model);

      if (!result) {
        logger.warn('turn-on goal returned false', {
          userId: appUserId,
          targetedAverageNeckAngle: model.targetedAverageNeckAngle,
          frequency: model.frequency,
        });
        res.status(400).json({ error: 'Failed to turn on goal.' });
        return;
      }

      logger.info('Goal turned on successfully', {
        userId: appUserId,
        targetedAverageNeckAngle: model.targetedAverageNeckAngle,
        frequency: model.frequency,
        reportCount: model.goalCycleCompletionReports?.length ?? 0,
      });
      res.status(201).json({ success: true, message: 'Goal turned on' });
    } catch (error) {
      logger.error('Error turning on goal', {
        userId: appUserId,
        targetedAverageNeckAngle: model.targetedAverageNeckAngle,
        frequency: model.frequency,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      if (error instanceof CustomException) {
        res.status(400).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async turnOffGoalByUserId(req: AuthenticatedRequest, res: Response): Promise<void> {
    const model: TurnOnGoalViewModel = req.body;
    const appUserId = req.user?.userId;

    if (!appUserId) {
      res.status(401).json({ error: 'Unauthorized: User ID is missing.' });
      return;
    }

    if (!model) {
      res.status(400).json({ error: 'Goal data with valid user ID is required.' });
      return;
    }

    try {
      const result = await GoalService.turnOffGoalAsync(appUserId, model);

      if (!result) {
        res.status(400).json({ error: 'Failed to turn off goal.' });
        return;
      }

      res.status(200).json({ success: true, message: 'Goal turned off' });
    } catch (error) {
      logger.error('Error turning off goal:');
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async getGoalsByUserId(req: AuthenticatedRequest, res: Response): Promise<void> {
    const appUserId = req.user?.userId;

    if (!appUserId) {
      res.status(401).json({ error: 'Unauthorized: User ID is missing.' });
      return;
    }

    try {
      const result = await GoalService.getAllGoalsByIdAsync(appUserId);

      // An empty history is a normal, successful state — a new user, or
      // anyone whose first goal cycle hasn't concluded yet, has zero
      // reports. That's not a 404: the resource (this user's goal history)
      // exists and was found; it's just empty. Returning 404 here meant
      // the mobile app's error handling kicked in (an "Unable to load your
      // goals" toast) for what should have been a quiet empty-state screen
      // — for most users, every single time they opened it.
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      logger.error('Error fetching goals by user ID:');
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async getCurrentTargetedAverageNeckAngle(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    const userId = req.user?.userId;

    if (!userId || userId.trim() === '') {
      res.status(400).json({ error: 'Valid user ID is required.' });
      return;
    }

    try {
      const result = await GoalService.getCurrentTargetedAverageNeckAngleAsync(userId);

      if (result === null || result === undefined) {
        res.status(404).json({ error: 'No neck angle data found for this user.' });
        return;
      }

      res.status(200).json({ success: true, data: result });
    } catch (error) {
      logger.error('Error fetching neck angle data:');
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}