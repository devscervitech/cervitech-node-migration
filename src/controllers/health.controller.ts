import { Request, Response } from 'express';
import { PushNotificationLog } from '../models/PushNotificationLog';
import { logger } from '../utils/logger';

export class HealthController {
  /**
   * Aggregate view of push delivery health: totals per status plus the most
   * recent confirmed failures. Device tokens are deliberately excluded so the
   * endpoint stays safe to expose without auth.
   */
  static async getPushHealth(_req: Request, res: Response): Promise<void> {
    try {
      const [total, delivered, pending, failed] = await Promise.all([
        PushNotificationLog.countDocuments({}),
        PushNotificationLog.countDocuments({ status: 'delivered' }),
        PushNotificationLog.countDocuments({ status: 'pending' }),
        PushNotificationLog.countDocuments({ status: 'failed' }),
      ]);

      const recentFailures = await PushNotificationLog.find({ status: 'failed' })
        .sort({ sentAt: -1 })
        .limit(10)
        .select('-token')
        .lean();

      res.status(200).json({
        success: true,
        message: 'Push health retrieved',
        data: { total, delivered, pending, failed, recentFailures },
      });
    } catch (error: any) {
      logger.error(`Push health check failed: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Failed to compute push health',
        error: error.message,
      });
    }
  }
}
