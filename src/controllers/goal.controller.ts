import { Request, Response } from 'express';
import { GoalService } from '../services/goal.service';
import { SetGoalViewModel, TurnOnGoalViewModel } from '../dtos/goal.DTO';
import { logger } from '../utils/logger';

export class GoalController {
  static async turnOnGoalByUserId(req: Request, res: Response): Promise<void> {
    const model: SetGoalViewModel = req.body;

    if (!model || !model.appUserId) {
      res.status(400).json({ error: 'Goal data with valid user ID is required.' });
      return;
    }

    try {
      const result = await GoalService.turnOnGoalAsync(model);

      if (!result) {
        res.status(400).json({ error: 'Failed to turn on goal.' });
        return;
      }

      res.status(201).json(result);
    } catch (error) {
      logger.error('Error turning on goal:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async turnOffGoalByUserId(req: Request, res: Response): Promise<void> {
    const model: TurnOnGoalViewModel = req.body;

    if (!model || !model.appUserId) {
      res.status(400).json({ error: 'Goal data with valid user ID is required.' });
      return;
    }

    try {
      const result = await GoalService.turnOffGoalAsync(model);

      if (!result) {
        res.status(400).json({ error: 'Failed to turn off goal.' });
        return;
      }

      res.status(200).json(result);
    } catch (error) {
      logger.error('Error turning off goal:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async getGoalsByUserId(req: Request, res: Response): Promise<void> {
    const model: TurnOnGoalViewModel = req.body;

    if (!model || !model.appUserId) {
      res.status(400).json({ error: 'User ID is required to fetch goals.' });
      return;
    }

    try {
      const result = await GoalService.getAllGoalsByIdAsync(model);

      res.status(200).json({
        success: true,
        data: result ?? [],
      });
    } catch (error) {
      logger.error('Error fetching goals by user ID:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }

  static async getCurrentTargetedAverageNeckAngle(req: Request, res: Response): Promise<void> {
    const userId = req.query.userid as string;

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

      res.status(200).json(result);
    } catch (error) {
      logger.error('Error fetching neck angle data:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}
