// services/appUserService.ts
import AppUser from '../../models/AppUser';
import { AppUserViewModel, toAppUserViewModel } from '../../viewmodels/AppUser.viewmodel';
import { FCMTokenUpdateViewModel } from '../../types/fcmToken.types';
import { CustomException } from '../../utils/customException';
import { logger } from '../../utils/logger';

export class FCMTokenService {
  static async updateFCMToken(update: FCMTokenUpdateViewModel): Promise<AppUserViewModel> {
    try {
      if (!update || typeof update._id !== 'string') {
        throw new CustomException('UserId is not provided');
      }

      const user = await AppUser.findOne({ _id: update._id }).exec();
      if (!user) {
        throw new CustomException(
          'This user cannot be retrieved at the moment, please contact support.'
        );
      }

      user.fcmToken = update.fcmToken ?? user.fcmToken;
      await user.save();

      return toAppUserViewModel(user);
    } catch (ex: unknown) {
      const error = ex instanceof Error ? ex : new Error('Unhandled exception');
      logger.error(error.message);
      throw error;
    }
  }
}