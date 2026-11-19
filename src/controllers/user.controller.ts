import { revokeToken } from '../utils/revokeToken';
import { TokenUtil } from '../utils/token.util';
import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { PictureUrlUpdateViewModel } from '../viewmodels/PictureUrlUpdateViewModel';
import { AppUserService } from '../services/appUserServices/appUserService.service';
import { GetUserDataService } from '../services/appUserServices/getUserData';
import { FCMTokenService } from '../services/appUserServices/fcmToken.service';
import { logger } from '../utils/logger';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import TokenBlacklist from '../models/TokenBlacklist';
import { CustomException } from '../utils/customException';
import { sendSuccess, sendError } from '../utils/apiResponse';

export class UserController {
  // -------------------------
  // Update profile picture
  // -------------------------
  static async updatePictureUrl(req: AuthenticatedRequest, res: Response): Promise<void> {
    const updateViewModel: PictureUrlUpdateViewModel = {
      userId: (req.user?.userId || '') as unknown as number,
      pictureUrl: req.body.PictureUrl ?? req.body.pictureUrl,
    };

    if (!updateViewModel.userId || !updateViewModel.pictureUrl) {
      sendError(res, 400, 'User ID and Picture URL are required.');
      return;
    }

    try {
      const result = await AppUserService.updatePictureUrlAsync(updateViewModel);
      if (!result) {
        sendError(res, 404, 'User not found or picture could not be updated.');
        return;
      }

      sendSuccess(res, undefined, 'Profile picture updated successfully.', 200);
    } catch (error: any) {
      logger.error('UpdatePictureUrl Error:', error.message);
      sendError(res, 500, 'Internal server error.');
    }
  }

  // -------------------------
  // Delete user by ID
  // -------------------------
  static async deleteById(req: Request, res: Response): Promise<void> {
    const id = req.params.id ?? req.query.id;
    if (!id) {
      sendError(res, 400, 'User ID is required.');
      return;
    }

    try {
      const result = await AppUserService.deleteByIdAsync(id);
      if (!result) {
        sendError(res, 404, 'User not found.');
        return;
      }

      sendSuccess(res, undefined, 'User deleted successfully.', 200);
    } catch (error: any) {
      logger.error('DeleteById Error:', error.message);
      sendError(res, 500, 'Failed to delete user.');
    }
  }

  // -------------------------
  // Request account deletion (legacy compatible)
  // -------------------------
  static async deleteMyAccount(req: AuthenticatedRequest, res: Response): Promise<void> {
    const email = req.user?.email;
    if (!email) {
      sendError(res, 400, 'Email is required.');
      return;
    }

    try {
      const result = await AppUserService.deleteAccountRequest(email);
      if (!result) {
        sendError(res, 404, 'Account not found.');
        return;
      }

      sendSuccess(res, undefined, 'Account deletion request submitted successfully.', 200);
    } catch (error: any) {
      logger.error('DeleteMyAccount Error:', error.message);
      sendError(res, 500, 'Internal server error.');
    }
  }

  // -------------------------
  // Check deletion-request token (safe, non-destructive)
  // -------------------------
  static async checkDeletionRequest(req: Request, res: Response): Promise<void> {
    const token = (req.params.token as string) ?? (req.query.token as string) ?? req.body.Token ?? req.body.token;
    if (!token) {
      sendError(res, 400, 'Token is required.');
      return;
    }

    try {
      const blacklisted = await TokenBlacklist.findOne({ token });
      if (blacklisted) {
        sendError(res, 400, 'This token has already been used or is invalid.');
        return;
      }

      const decoded = TokenUtil.verifyToken(token, 'account_deletion');
      if (!decoded?.userId) {
        sendError(res, 400, 'Invalid or expired token.');
        return;
      }

      sendSuccess(res, { valid: true, pending: true }, 'Token is valid; deletion is pending confirmation.', 200);
    } catch (error: any) {
      logger.error('CheckDeletionRequest Error:', error.message);
      sendError(res, 400, 'Invalid or expired token.');
    }
  }

  // -------------------------
  // Confirm deletion via token (destructive)
  // -------------------------
  static async confirmDeleteMyAccount(req: Request, res: Response): Promise<void> {
    const token = (req.params.token as string) ?? (req.query.token as string) ?? req.body.Token ?? req.body.token;
    if (!token) {
      sendError(res, 400, 'Token is required.');
      return;
    }

    try {
      const blacklisted = await TokenBlacklist.findOne({ token });
      if (blacklisted) {
        sendError(res, 400, 'This token has already been used or is invalid.');
        return;
      }

      const decoded = TokenUtil.verifyToken(token, 'account_deletion');
      if (!decoded?.userId) {
        sendError(res, 400, 'Invalid or expired token.');
        return;
      }

      const result = await AppUserService.deleteByIdAsync(decoded.userId);
      await revokeToken(token);

      if (result) sendSuccess(res, undefined, 'Account deleted successfully.', 200);
      else sendError(res, 404, 'Account not found.');
    } catch (error: any) {
      logger.error('ConfirmDeleteMyAccount Error:', error.message);
      sendError(res, 400, 'Invalid or expired token.');
    }
  }

  // -------------------------
  // Toggle push notification preference
  // -------------------------
  static async toggleAllowPushNotifications(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    const id = req.user?.userId;
    if (!id) {
      sendError(res, 400, 'User ID is required.');
      return;
    }

    try {
      await AppUserService.toggleAllowPushNotificationsAsync(id);
      sendSuccess(res, undefined, 'Push notification preference updated successfully.', 200);
    } catch (error: any) {
      logger.error('ToggleAllowPushNotifications Error:', error.message);
      sendError(res, 500, 'Failed to toggle push notifications.');
    }
  }

  // -------------------------
  // Get response rate
  // -------------------------
  static async getResponseRate(req: Request, res: Response) {
    const body = req.body ?? {};
    const id = (req.query.id as string) ?? body.Id ?? body.id ?? '';
    const dateStr = (req.query.date as string) ?? body.date;

    if (!id || !dateStr || isNaN(Date.parse(dateStr))) {
      sendError(res, 400, 'Invalid or missing user ID/date.');
      return;
    }

    if (!mongoose.isValidObjectId(id)) {
      sendError(res, 400, 'Invalid user ID format.');
      return;
    }

    try {
      const date = new Date(dateStr);
      console.log('Fetching response rate for userId:', id, 'on date:', date);
      const result = await AppUserService.getResponseRateAsync(id, date);
      res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      logger.error('GetResponseRate Error:', error);
      sendError(res, 500, error?.message || 'Failed to fetch response rate.');
    }
  }

  // -------------------------
  // Update user profile
  // -------------------------
  static async updateUser(req: AuthenticatedRequest, res: Response) {
    const userId = req.user?.userId ?? req.body.Id ?? req.body.id ?? req.body._id;
    if (!userId) {
      sendError(res, 400, 'User ID is required.');
      return;
    }

    try {
      const normalizedUpdate: {
        email?: string;
        firstName?: string;
        lastName?: string;
        username?: string;
        telephone?: string;
      } = {
        email: req.body.email ?? req.body.Email,
        firstName: req.body.firstName ?? req.body.FirstName,
        lastName: req.body.lastName ?? req.body.LastName,
        username: (req.body.username ?? req.body.Username)?.toLowerCase?.(),
        telephone: req.body.telephone ?? req.body.Telephone,
      };

      const updatedUser = await AppUserService.updateUser(userId, normalizedUpdate);
      sendSuccess(res, updatedUser, 'User profile updated successfully.', 200);
    } catch (err: any) {
      logger.error('UpdateUser Error:', err.message);
      sendError(res, 400, err.message || 'Failed to update user.');
    }
  }

  // -------------------------
  // Get user by email
  // -------------------------
  static async getByEmail(req: Request, res: Response): Promise<void> {
    const email = req.query.email;
    console.log(email);
    if (!email || typeof email !== 'string') {
      sendError(res, 400, 'Email is required and must be a string.');
      return;
    }

    try {
      const user = await GetUserDataService.getByEmail(email);
      res.status(200).json({ success: true, data: user });
    } catch (error: any) {
      logger.error('GetByEmail Error:', error.message);
      if (error instanceof CustomException) sendError(res, 404, error.message);
      else sendError(res, 500, 'Internal server error.');
    }
  }

  // Get user profile by Id
  static async fetch_user_profile(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id ?? req.query.id;

      if (!id || typeof id !== 'string') {
        sendError(res, 400, 'Id is required and must be a string.');
        return;
      }

      const user = await GetUserDataService.getById(id);
      res.status(200).json({ success: true, data: user });
    } catch (error: any) {
      logger.error('GetById Error:', error.message);
      if (error instanceof CustomException) sendError(res, 404, error.message);
      else sendError(res, 500, 'Internal server error.');
    }
  }

  // -------------------------
  // Get push notification status
  // -------------------------
  static async getAllowPushNotificationStatus(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    try {
      const allowPush = await GetUserDataService.getAllowPushNotificationStatus(userId);
      res.status(200).json({ success: true, data: { allowPushNotifications: allowPush } });
    } catch (error: any) {
      logger.error('GetAllowPushNotificationStatus Error:', error.message);
      sendError(
        res,
        error instanceof CustomException ? 404 : 500,
        error instanceof CustomException ? error.message : 'Internal server error.'
      );
    }
  }

  // -------------------------
  // Get FCM token by username
  // -------------------------
  // -------------------------
  // Update FCM token
  // -------------------------
  static async updateFCMToken(req: AuthenticatedRequest, res: Response): Promise<void> {
    const body = req.body ?? {};
    const fcmToken = (body.FCMToken ?? body.fcmToken ?? body.token) as string;
    const _id = req.user?.userId;

    if (!_id) {
      sendError(res, 401, 'Unauthorized');
      return;
    }

    if (!fcmToken || typeof fcmToken !== 'string') {
      sendError(res, 400, 'Invalid request. Provide valid fcmToken.');
      return;
    }

    try {
      await FCMTokenService.updateFCMToken({ fcmToken, _id });
      sendSuccess(res, undefined, 'FCM token updated successfully.', 200);
    } catch (error: any) {
      logger.error('UpdateFCMToken Error:', error.message);
      sendError(
        res,
        error instanceof CustomException ? 400 : 500,
        error instanceof CustomException ? error.message : 'Internal server error.'
      );
    }
  }
}
