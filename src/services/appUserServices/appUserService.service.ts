import AppUser, { IAppUser } from '../../models/AppUser';
import ResponseRate from '../../models/ResponseRate';
import { PictureUrlUpdateViewModel } from '../../viewmodels/PictureUrlUpdateViewModel';
import { AppUserResponse, ResponseRateViewModel } from '../../viewmodels/ResponseRateViewModel';
import { Activity } from '../../viewmodels/Activity';
import { CustomException } from '../../utils/customException';
import { NeckAngleRecordModel } from '../../models/NeckAngleRecord';
import { DateLibrary } from '../../utils/dateLibrary';
import { Goal } from '../../models/Goal';
import { GoalCycleCompletionReport } from '../../models/GoalCycleCompletionReport';
import { PushNotificationDriver } from '../pushNotificationDriver';
import { PushNotificationModelDTO } from '../../types/pushNotificationModel.types';
import { logger } from '../../utils/logger';
import { UpdateUserRequest } from '../../types/user.types';
import { AppUserViewModel, toAppUserViewModel } from '../../viewmodels/AppUser.viewmodel';
import User from '../../models/User';
// import {FCMTokenUpdateViewModel} from "../../viewmodels/FCMTokenUpdateViewModel";
import { TokenUtil } from '../../utils/token.util';
import { EmailUtils } from '../../utils/EmailService/emailutils';

export class AppUserService {
  private static toAppUserResponse(user: IAppUser): AppUserResponse {
    return {
      id: String(user._id),
      username: user.username,
      email: user.email,
      FCMToken: user.fcmToken,
      hasPaid: user.hasPaid,
      firstName: user.firstName,
      lastName: user.lastName,
      pictureUrl: user.pictureUrl,
      isGoalOn: user.isGoalOn,
      allowPushNotifications: user.allowPushNotifications,
      mobileChannel: user.mobileChannel,
      dateRegistered: user.dateRegistered?.toString(),
      responseRate: user.responseRate,
      lastLoginDateTime: user.lastLoginDateTime,
    };
  }

  static async getAppUserResponse(userId: string): Promise<AppUserResponse> {
    if (!userId || userId.trim() === '') {
      throw new CustomException('UserId not provided');
    }

    const user = await AppUser.findById(userId);
    if (!user) {
      throw new CustomException('This user cannot be retrieved at the moment. Please contact support.');
    }

    return this.toAppUserResponse(user);
  }

  // Grants paid entitlement directly. Only call this for a transaction whose
  // status is confirmed Completed -- see TransactionService.transactionRecords.
  static async grantPaidEntitlement(userId: string): Promise<AppUserResponse> {
    try {
      if (!userId || userId.trim() === '') {
        throw new Error('UserId not provided');
      }

      const user = await AppUser.findById(userId);
      if (!user) {
        throw new Error('This user cannot be retrieved at the moment. Please contact support.');
      }

      user.hasPaid = true;
      await user.save();

      return this.toAppUserResponse(user);
    } catch (error) {
      logger.error('Error in grantPaidEntitlement:');
      throw new CustomException('Error updating subscription.');
    }
  }

  static async updatePictureUrlAsync(update: PictureUrlUpdateViewModel): Promise<boolean> {
    if (!update || !update.userId) {
      throw new Error('User ID not provided.');
    }

    const user = await AppUser.findById(update.userId);
    if (!user) {
      throw new Error('User not found. Please contact support.');
    }

    user.pictureUrl = update.pictureUrl ?? user.pictureUrl;
    await user.save();

    return true;
  }

  static async deleteByIdAsync(id: string): Promise<boolean> {
    try {
      const user = await AppUser.findById(id);
      console.log(user);

      if (!user) {
        throw new CustomException('User does not exist');
      }

      user.deleted = true;
      await user.save();

      try {
        await EmailUtils.sendAccountDeletionConfirmation(user.email, user.username);
      } catch (emailError) {
        logger.error('Failed to send deletion confirmation email:', emailError);
      }

      return true;
    } catch (ex: any) {
      if (ex instanceof CustomException) {
        logger.error(ex.message);
      } else {
        logger.error('Unexpected error while deleting by ID', { error: ex });
      }
      throw ex;
    }
  }

  static async deleteByEmailAsync(email: string): Promise<boolean> {
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const user = await AppUser.findOne({ email: normalizedEmail });

      if (!user) {
        throw new CustomException('User does not exist');
      }

      user.deleted = true;
      await user.save();

      try {
        await EmailUtils.sendAccountDeletionConfirmation(normalizedEmail, user.username);
      } catch (emailError) {
        logger.error('Failed to send deletion confirmation email:', emailError);
      }

      return true;
    } catch (ex: any) {
      if (ex instanceof CustomException) {
        logger.error(ex.message);
      } else {
        logger.error('Unexpected error while deleting by email', { error: ex });
      }
      throw ex;
    }
  }

  static async deleteAccountRequest(email: string): Promise<boolean> {
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const user = await AppUser.findOne({ email: normalizedEmail });

      if (!user) {
        throw new CustomException('User does not exist');
      }

      const token = TokenUtil.generateToken(user._id.toString(), 'account_deletion');
      console.log('Generated token:', token);

      console.log('Token before sending email:', token);
      await EmailUtils.sendAccountDeletionRequest(normalizedEmail, user.username, token);

      return true;
    } catch (ex: any) {
      if (ex instanceof CustomException) {
        logger.error(ex.message);
      } else {
        logger.error('Unexpected error while requesting account deletion', {
          error: ex,
        });
      }
      throw ex;
    }
  }

  static async deleteAllAsync(): Promise<boolean> {
    try {
      await AppUser.updateMany({ deleted: { $ne: true } }, { $set: { deleted: true } });
      return true;
    } catch (ex: any) {
      logger.error('Unexpected error while deleting all users', { error: ex });
      throw ex;
    }
  }

  static async toggleAllowPushNotificationsAsync(userId: string): Promise<boolean> {
    try {
      if (!userId || userId.trim() === '') {
        throw new Error('UserId not provided');
      }

      const user = await AppUser.findById(userId);
      if (!user) {
        throw new Error('User not found.');
      }

      user.allowPushNotifications = !user.allowPushNotifications;
      await user.save();

      return user.allowPushNotifications;
    } catch (error) {
      logger.error('Error in toggleAllowPushNotificationsAsync:', error);
      throw new CustomException('Error toggling push notifications.');
    }
  }

  static async postResponseRateAsync(userId: string): Promise<boolean> {
    try {
      const responseRate = await ResponseRate.findOne({ userId });

      if (responseRate) {
        responseRate.response = 1;
        await responseRate.save();
      }

      return true;
    } catch (error: any) {
      logger.error(error.message || 'Unhandled exception in postResponseRate');
      throw error;
    }
  }

  static async getResponseRateAsync(userId: string, day: Date): Promise<ResponseRateViewModel> {
    try {
      const startOfDay = new Date(day);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(day);
      endOfDay.setHours(23, 59, 59, 999);
      console.log(
        'Calculating response rate for userId:',
        userId,
        'from',
        startOfDay,
        'to',
        endOfDay
      );
      const responseRates = await ResponseRate.find({
        appUserId: userId,
        dateCreated: { $gte: startOfDay, $lte: endOfDay },
      });

      console.log('Fetched response rates:', responseRates);

      const totalPrompts = responseRates.reduce((sum, r) => sum + (r.prompt || 0), 0);
      const totalResponses = responseRates.reduce((sum, r) => sum + (r.response || 0), 0);

      const groupedByHour: Record<number, { prompts: number; responses: number }> = {};
      responseRates.forEach((entry) => {
        const hour = new Date(entry.dateCreated).getHours();
        if (!groupedByHour[hour]) {
          groupedByHour[hour] = { prompts: 0, responses: 0 };
        }
        groupedByHour[hour].prompts += entry.prompt || 0;
        groupedByHour[hour].responses += entry.response || 0;
      });

      const activity: Activity[] = Object.entries(groupedByHour).map(([hourStr, group]) => {
        const hour = parseInt(hourStr);
        const activityPercentage =
          group.prompts === 0 ? 0 : (group.responses / group.prompts) * 100;
        return { hour, prompts: group.prompts, responses: group.responses, activityPercentage };
      });

      const responseRate = totalPrompts === 0 ? 0 : (totalResponses / totalPrompts) * 100;

      return {
        appUserId: userId,
        responseRate,
        totalPrompts,
        totalResponses,
        activity,
      };
    } catch (error: any) {
      logger.error('Error in getResponseRateAsync:', error?.message || String(error));
      throw new CustomException('Error retrieving response rate.');
    }
  }

  static async calculateAverageOfLastWeekOrDay(
    userId: string,
    frequency: string,
    dateCreated: Date,
    goalId: string
  ): Promise<boolean> {
    try {
      let records;

      if (frequency === 'DAILY') {
        records = await NeckAngleRecordModel.find({
          appUserId: userId,
          dateTimeRecorded: {
            $gte: DateLibrary.getYesterdayDateTime(),
            $lte: DateLibrary.getCurrentDateTime(),
          },
        });
      } else if (frequency === 'WEEKLY') {
        records = await NeckAngleRecordModel.find({
          appUserId: userId,
          dateTimeRecorded: {
            $gte: DateLibrary.getLastWeekDateTime(),
            $lte: DateLibrary.getCurrentDateTime(),
          },
        });
      } else {
        throw new CustomException('Invalid Goal Frequency');
      }

      if (records.length === 0) return false;

      const average = records.reduce((sum, r) => sum + r.angle, 0) / records.length;
      const goal = await Goal.findById(goalId);
      if (!goal) return false;

      const compliance =
        average >= goal.targetedAverageNeckAngle
          ? 100
          : Math.min(100, Math.round((average / goal.targetedAverageNeckAngle) * 1000) / 10);

      const goalCycleReport = new GoalCycleCompletionReport({
        actualAverageNeckAngle: isNaN(average) ? 0 : Math.round(average * 10) / 10,
        complianceInPercentage: isNaN(compliance) ? 0 : compliance,
        dateOfConcludedCycle: DateLibrary.getCurrentDateTime(),
        goalId,
      });

      await goalCycleReport.save();

      const userFCMToken = await this.getFCMTokenById(userId);
      if (!userFCMToken) throw new CustomException('User does not have an FCM Token');

      const pushNotificationModel: PushNotificationModelDTO = {
        to: userFCMToken,
        title: 'Your set goal',
        body: `Hi, you scored ${goalCycleReport.complianceInPercentage}/100`,
      };

      await PushNotificationDriver.sendPushNotification(pushNotificationModel);

      return true;
    } catch (error) {
      logger.error(error instanceof CustomException ? error.message : String(error));
      throw error;
    }
  }

  static async getFCMTokenById(id: string): Promise<string> {
    try {
      const user = await AppUser.findOne({ id }).exec();
      if (!user) {
        throw new CustomException('User does not exist in our system');
      }
      return user.fcmToken;
    } catch (error) {
      logger.error(error instanceof CustomException ? error.message : String(error));
      throw error;
    }
  }

  static async updateUser(
    userId: string,
    update: UpdateUserRequest
  ): Promise<AppUserViewModel & { neckAngleRecords: IAppUser['neckAngleRecords'] }> {
    if (!userId) {
      throw new CustomException('User Id is missing from request.');
    }

    const user = await AppUser.findById(userId);
    if (!user) {
      throw new CustomException(
        'This user cannot be retrieved at the moment, please contact support.'
      );
    }
    user.email = update.email ?? user.email;
    user.firstName = update.firstName ?? user.firstName;
    user.lastName = update.lastName ?? user.lastName;
    user.username = update.username ?? user.username;
    user.telephone = update.telephone ?? user.telephone;

    await user.save();

    return { ...toAppUserViewModel(user), neckAngleRecords: user.neckAngleRecords ?? [] };
  }

  static async emailAlreadyExistsAsync(email: string): Promise<boolean> {
    const normalizedEmail = email.trim().toLowerCase();

    const exists = await AppUser.exists({ email: normalizedEmail });

    return !!exists; // convert result to true/false
  }
}
