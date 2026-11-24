import { Request, Response } from 'express';
import backofficeUserService, {
  BackofficeAdminMutationBusyError,
} from '../services/backofficeuser.service';
import { logger } from '../utils/logger';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { sendSuccess, sendError } from '../utils/apiResponse';
import { singleString } from '../utils/compat.util';
import type { IBackofficeUser } from '../models/BackOfficeUser';
import type { backOfficeUserModel } from '../types/backOfficeUserModel.types';
import { validateBackofficeInput } from '../validation/backOfficeUserValidation';
import {
  createBackofficeUserSchema,
  updateBackofficeProfileSchema,
  updateBackofficeAccessSchema,
  backofficeLoginSchema,
  backofficeChangePasswordSchema,
  backofficeForgotPasswordSchema,
  backofficeVerifyResetOtpSchema,
  backofficeResetPasswordSchema,
} from '../validation/schemas/backOfficeUser.schema';
import mongoose from 'mongoose';

function toBackofficeUserView(user: IBackofficeUser) {
  return {
    id: String(user._id),
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    telephone: user.telephone,
    username: user.username,
    accessLevel: user.accessLevel,
    readOnly: user.readOnly,
    dateRegistered: user.dateRegistered,
  };
}

class BackOfficeUserController {
  static async createUser(req: Request, res: Response) {
    const validation = validateBackofficeInput<backOfficeUserModel>(
      createBackofficeUserSchema,
      req.body
    );
    if (validation.error !== null) return sendError(res, 400, validation.error);

    try {
      const data = await backofficeUserService.create(validation.value);
      logger.info('BackOffice user created successfully.', { user: validation.value.username });

      sendSuccess(res, toBackofficeUserView(data), 'User created successfully.', 201);
    } catch (err: any) {
      logger.error('Create User Error', { error: err });
      if (err instanceof BackofficeAdminMutationBusyError) {
        return sendError(res, 409, 'Another back-office account security change is in progress. Retry shortly.');
      }
      sendError(res, 500, 'Failed to create user.');
    }
  }

  static async loginController(req: Request, res: Response) {
    const validation = validateBackofficeInput<{ username: string; password: string }>(
      backofficeLoginSchema,
      req.body
    );
    if (validation.error !== null) return sendError(res, 400, validation.error);

    try {
      const { username, password } = validation.value;

      const { user, token } = await backofficeUserService.loginService(username, password);

      logger.info('Backoffice login successful.', { username });

      sendSuccess(
        res,
        { id: user._id, username: user.username, accessLevel: user.accessLevel, token },
        'Login successful.',
        200
      );
    } catch (err: any) {
      logger.error('Login Error', { error: err });
      sendError(res, 401, 'Invalid username or password.');
    }
  }

  static async logoutController(req: Request, res: Response) {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return sendError(res, 400, 'Authorization token missing.');
      }

      const token = authHeader.split(' ')[1];
      await backofficeUserService.logoutService(token);

      logger.info('User logged out successfully.');
      sendSuccess(res, undefined, 'Logout successful. Token invalidated.', 200);
    } catch (err: any) {
      logger.error('Logout Error', { error: err });
      sendError(res, 500, 'Failed to logout user.');
    }
  }

  static async forgotPassword(req: Request, res: Response) {
    const validation = validateBackofficeInput<{ email: string }>(
      backofficeForgotPasswordSchema,
      req.body
    );
    if (validation.error !== null) return sendError(res, 400, validation.error);

    try {
      const data = await backofficeUserService.sendPasswordResetToken(validation.value.email);
      logger.info('Backoffice password reset request processed.');
      sendSuccess(res, data, data.message, 200);
    } catch (err: any) {
      logger.error('Forgot Password Error', { error: err });
      sendError(res, 500, 'Unable to process password reset request.');
    }
  }

  static async verifyResetOtp(req: Request, res: Response) {
    const validation = validateBackofficeInput<{ email: string; otp: string }>(
      backofficeVerifyResetOtpSchema,
      req.body
    );
    if (validation.error !== null) return sendError(res, 400, validation.error);

    try {
      const { email, otp } = validation.value;

      const data = await backofficeUserService.verifyResetOtp(email, otp);
      logger.info('Reset OTP verified.', { email });
      sendSuccess(res, data, 'OTP verified successfully.', 200);
    } catch (err: any) {
      logger.error('Verify Reset OTP Error', { error: err });
      sendError(res, 400, 'Invalid or expired OTP.');
    }
  }

  static async changePassword(req: AuthenticatedRequest, res: Response) {
    const validation = validateBackofficeInput<{ currentPassword: string; newPassword: string }>(
      backofficeChangePasswordSchema,
      req.body
    );
    if (validation.error !== null) return sendError(res, 400, validation.error);

    const userId = req.user?.userId;
    if (!userId) return sendError(res, 401, 'Unauthorized. Please log in.');

    try {
      const { currentPassword, newPassword } = validation.value;
      const result = await backofficeUserService.changePassword(
        userId,
        currentPassword,
        newPassword
      );
      if (result.status === 'invalid_new_password') {
        return sendError(res, 400, 'New password cannot be empty.');
      }
      if (result.status === 'not_found') return sendError(res, 404, 'User not found.');
      if (result.status === 'incorrect_current_password') {
        return sendError(res, 401, 'Current password is incorrect.');
      }

      logger.info('Password changed successfully.', { userId });
      sendSuccess(res, undefined, 'Password changed successfully.', 200);
    } catch (err: any) {
      logger.error('Change Password Error', { error: err });
      sendError(res, 500, 'Failed to change password.');
    }
  }

  static async resetPassword(req: Request, res: Response) {
    const validation = validateBackofficeInput<{ token: string; newPassword: string }>(
      backofficeResetPasswordSchema,
      req.body
    );
    if (validation.error !== null) return sendError(res, 400, validation.error);

    try {
      const { token, newPassword } = validation.value;
      const data = await backofficeUserService.resetPassword(token, newPassword);
      logger.info('Backoffice password reset successful.');
      sendSuccess(res, data, 'Password reset successful.', 200);
    } catch (err: any) {
      logger.error('Reset Password Error', { error: err });
      sendError(res, 400, 'Invalid or expired password reset token.');
    }
  }

  static async getUsers(req: AuthenticatedRequest, res: Response) {
    try {
      const limitVal = req.query.limit ?? req.params.limit;
      if (limitVal !== undefined) {
        const limitNum = Number(limitVal);
        if (isNaN(limitNum) || limitNum <= 0) {
          logger.warn('Requested number of users is zero or invalid.');
          return sendError(res, 400, 'Limit must be greater than zero.');
        }
        const data = await backofficeUserService.getNumberOfBackOfficeUsers(limitNum);
        logger.info('Fetched number of backoffice users.', { count: limitNum });
        return sendSuccess(
          res,
          data.map(toBackofficeUserView),
          `Retrieved ${limitNum} back office users successfully.`,
          200
        );
      }

      const data = await backofficeUserService.getAll();
      logger.info('Fetched all backoffice users.');
      return sendSuccess(res, data.map(toBackofficeUserView), 'Users retrieved successfully.', 200);
    } catch (err: any) {
      logger.error('Get Users Error', { error: err });
      return sendError(res, 500, 'Failed to retrieve users.');
    }
  }

  static async deleteUser(req: AuthenticatedRequest, res: Response) {
    try {
      const id = singleString(req.params.id);
      const actorId = req.user?.userId;
      if (!actorId) return sendError(res, 401, 'Unauthorized. Please log in.');
      if (!id || !mongoose.isValidObjectId(id)) return sendError(res, 400, 'Invalid user ID.');

      const result = await backofficeUserService.deleteById(id, actorId);

      if (result.status === 'not_found') {
        logger.warn('Attempted to delete non-existing user.', { id });
        return sendError(res, 404, 'User not found.');
      }
      if (result.status === 'self_modification') {
        return sendError(res, 403, 'You cannot delete your own back-office account.');
      }
      if (result.status === 'not_admin') {
        return sendError(res, 403, 'Administrator privileges are required.');
      }
      if (result.status === 'not_writable') {
        return sendError(res, 403, 'A writable back-office account is required.');
      }
      if (result.status === 'last_admin') {
        return sendError(res, 409, 'Cannot delete the last active back-office administrator.');
      }
      if (result.status === 'last_writable') {
        return sendError(res, 409, 'Cannot delete the last writable back-office account.');
      }
      if (result.status === 'admin_mutation_busy') {
        return sendError(res, 409, 'Another back-office account security change is in progress. Retry shortly.');
      }

      logger.info('User deleted successfully.', { id });
      sendSuccess(res, undefined, 'User deleted successfully.', 200);
    } catch (err: any) {
      logger.error('Delete User Error', { error: err });
      sendError(res, 500, 'Failed to delete user.');
    }
  }

  static async updateUser(req: Request, res: Response) {
    try {
      const id = singleString(req.params.id);

      if (!id || !mongoose.isValidObjectId(id)) return sendError(res, 400, 'Valid user ID is required.');

      const validation = validateBackofficeInput<
        Partial<Pick<IBackofficeUser, 'firstName' | 'lastName' | 'email' | 'telephone'>>
      >(updateBackofficeProfileSchema, req.body);
      if (validation.error !== null) return sendError(res, 400, validation.error);

      const data = await backofficeUserService.update(id, validation.value);
      if (!data) {
        logger.warn('Update attempted on non-existing user.', { id });
        return sendError(res, 404, 'User not found.');
      }

      logger.info('User updated successfully.', { id });
      sendSuccess(res, toBackofficeUserView(data), 'User updated successfully.', 200);
    } catch (err: any) {
      logger.error('Update User Error', { error: err });
      sendError(res, 500, 'Failed to update user.');
    }
  }

  static async updateAccess(req: AuthenticatedRequest, res: Response) {
    const id = singleString(req.params.id);
    const actorId = req.user?.userId;
    if (!actorId) return sendError(res, 401, 'Unauthorized. Please log in.');
    if (!id || !mongoose.isValidObjectId(id)) return sendError(res, 400, 'Valid user ID is required.');

    const validation = validateBackofficeInput<
      Partial<Pick<IBackofficeUser, 'accessLevel' | 'readOnly'>>
    >(updateBackofficeAccessSchema, req.body);
    if (validation.error !== null) return sendError(res, 400, validation.error);

    try {
      const result = await backofficeUserService.updateAccess(id, actorId, validation.value);
      if (result.status === 'not_found') return sendError(res, 404, 'User not found.');
      if (result.status === 'not_admin') {
        return sendError(res, 403, 'Administrator privileges are required.');
      }
      if (result.status === 'self_modification') {
        return sendError(res, 403, 'You cannot change your own access settings.');
      }
      if (result.status === 'not_writable') {
        return sendError(res, 403, 'A writable back-office account is required.');
      }
      if (result.status === 'last_writable') {
        return sendError(res, 409, 'Cannot disable the last writable back-office account.');
      }
      if (result.status === 'last_admin') {
        return sendError(res, 409, 'Cannot disable or demote the last active administrator.');
      }
      if (result.status === 'admin_mutation_busy') {
        return sendError(res, 409, 'Another back-office account security change is in progress. Retry shortly.');
      }

      logger.info('BackOffice access metadata updated.', { actorId, targetId: id });
      return sendSuccess(res, toBackofficeUserView(result.user), 'Access metadata updated.', 200);
    } catch (err: any) {
      logger.error('Update BackOffice Access Error', { error: err });
      return sendError(res, 500, 'Failed to update access metadata.');
    }
  }

  static async testUserById(req: Request, res: Response) {
    try {
      const id = singleString(req.params.id);
      if (!id || !mongoose.isValidObjectId(id)) return sendError(res, 400, 'Valid user ID is required.');

      const user = await backofficeUserService.getById(id);

      if (!user) {
        logger.warn('TestUserById: user not found.', { id });
        return sendError(res, 404, 'User not found.');
      }

      logger.info('TestUserById: user retrieved successfully.', { id });
      sendSuccess(res, toBackofficeUserView(user), 'User retrieved successfully.', 200);
    } catch (err: any) {
      logger.error('Test User Error', { error: err });
      sendError(res, 500, 'Failed to retrieve user.');
    }
  }
}

export default BackOfficeUserController;
