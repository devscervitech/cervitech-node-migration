import { Request, Response } from 'express';
import backofficeUserService from '../services/backofficeuser.service';
import { logger } from '../utils/logger';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { sendSuccess, sendError } from '../utils/apiResponse';

class BackOfficeUserController {
  static async createUser(req: Request, res: Response) {
    try {
      const data = await backofficeUserService.create(req.body);
      logger.info('BackOffice user created successfully.', { user: req.body.username });

      sendSuccess(res, data, 'User created successfully.', 201);
    } catch (err: any) {
      logger.error('Create User Error', { error: err.message });
      sendError(res, 500, 'Failed to create user.', err.message);
    }
  }

  static async loginController(req: Request, res: Response) {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return sendError(res, 400, 'Username and password are required.');
      }

      const { user, token } = await backofficeUserService.loginService(username, password);

      logger.info('Backoffice login successful.', { username });

      sendSuccess(
        res,
        { id: user._id, username: user.username, accessLevel: user.accessLevel, token },
        'Login successful.',
        200
      );
    } catch (err: any) {
      logger.error('Login Error', { error: err.message });
      sendError(res, 401, 'Invalid username or password.', err.message);
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
      logger.error('Logout Error', { error: err.message });
      sendError(res, 500, 'Failed to logout user.', err.message);
    }
  }

  static async forgotPassword(req: Request, res: Response) {
    try {
      const { email } = req.body;
      if (!email) {
        return sendError(res, 400, 'Email is required.');
      }

      const data = await backofficeUserService.sendPasswordResetToken(email);
      logger.info('Password reset code sent.', { email });
      sendSuccess(res, data, 'Password reset code sent.', 200);
    } catch (err: any) {
      logger.error('Forgot Password Error', { error: err.message });
      sendError(res, 500, 'Failed to send password reset code.', err.message);
    }
  }

  static async verifyResetOtp(req: Request, res: Response) {
    try {
      const { email, otp } = req.body;
      if (!email || !otp) {
        return sendError(res, 400, 'Email and OTP are required.');
      }

      const data = await backofficeUserService.verifyResetOtp(email, otp);
      logger.info('Reset OTP verified.', { email });
      sendSuccess(res, data, 'OTP verified successfully.', 200);
    } catch (err: any) {
      logger.error('Verify Reset OTP Error', { error: err.message });
      sendError(res, 400, err.message);
    }
  }

  static async changePassword(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const { newPassword } = req.body;
      if (!userId || !newPassword) {
        return sendError(res, 400, 'User ID and new password are required.');
      }

      const data = await backofficeUserService.changePassword(userId, newPassword);
      logger.info('Password changed successfully.', { userId });
      sendSuccess(res, data, 'Password changed successfully.', 200);
    } catch (err: any) {
      logger.error('Change Password Error', { error: err.message });
      sendError(res, 500, 'Failed to change password.', err.message);
    }
  }

  static async resetPassword(req: Request, res: Response) {
    try {
      const { token, newPassword } = req.body;
      if (!token || !newPassword) {
        return sendError(res, 400, 'Token and new password are required.');
      }

      const data = await backofficeUserService.resetPassword(token, newPassword);
      logger.info('Password reset successful.', { token });
      sendSuccess(res, data, 'Password reset successful.', 200);
    } catch (err: any) {
      logger.error('Reset Password Error', { error: err.message });
      sendError(res, 500, 'Failed to reset password.', err.message);
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
          data,
          `Retrieved ${limitNum} back office users successfully.`,
          200
        );
      }

      const data = await backofficeUserService.getAll();
      logger.info('Fetched all backoffice users.');
      return sendSuccess(res, data, 'Users retrieved successfully.', 200);
    } catch (err: any) {
      logger.error('Get Users Error', { error: err.message });
      return sendError(res, 500, 'Failed to retrieve users.', err.message);
    }
  }

  static async deleteUser(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const data = await backofficeUserService.deleteById(id);

      if (!data) {
        logger.warn('Attempted to delete non-existing user.', { id });
        return sendError(res, 404, 'User not found.');
      }

      logger.info('User deleted successfully.', { id });
      sendSuccess(res, data, 'User deleted successfully.', 200);
    } catch (err: any) {
      logger.error('Delete User Error', { error: err.message });
      sendError(res, 500, 'Failed to delete user.', err.message);
    }
  }

  static async updateUser(req: Request, res: Response) {
    try {
      const id = req.params.id || req.body.id;
      const updateData = req.params.id ? req.body : { ...req.body, id: undefined };

      if (!id) {
        return sendError(res, 400, 'User ID is required for update.');
      }

      const data = await backofficeUserService.update(id, updateData);
      if (!data) {
        logger.warn('Update attempted on non-existing user.', { id });
        return sendError(res, 404, 'User not found.');
      }

      logger.info('User updated successfully.', { id });
      sendSuccess(res, data, 'User updated successfully.', 200);
    } catch (err: any) {
      logger.error('Update User Error', { error: err.message });
      sendError(res, 500, 'Failed to update user.', err.message);
    }
  }

  static async testUserById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const user = await backofficeUserService.getById(id);

      if (!user) {
        logger.warn('TestUserById: user not found.', { id });
        return sendError(res, 404, 'User not found.');
      }

      logger.info('TestUserById: user retrieved successfully.', { id });
      sendSuccess(res, user, 'User retrieved successfully.', 200);
    } catch (err: any) {
      logger.error('Test User Error', { error: err.message });
      sendError(res, 500, 'Failed to retrieve user.', err.message);
    }
  }
}

export default BackOfficeUserController;
