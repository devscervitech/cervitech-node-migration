import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { TokenUtil } from '../utils/token.util';
import TokenBlacklist from '../models/TokenBlacklist';
import { logger } from '../utils/logger';
import { sendSuccess, sendError } from '../utils/apiResponse';

export const AuthController = {
  // -------------------------
  // Signup (legacy-safe)
  // -------------------------
  async signup(req: Request, res: Response) {
    try {
      const body = {
        username: (req.body.Username ?? req.body.username)?.toLowerCase?.(),
        firstName: req.body.FirstName ?? req.body.firstName,
        lastName: req.body.LastName ?? req.body.lastName,
        email: (req.body.Email ?? req.body.email)?.toLowerCase?.(),
        password: req.body.Password ?? req.body.password,
        confirmPassword: req.body.ConfirmPassword ?? req.body.confirmPassword,
        mobileChannel: req.body.MobileChannel ?? req.body.mobileChannel,
        fcmToken: req.body.FCMToken ?? req.body.fcmToken,
        pictureUrl: req.body.PictureUrl ?? req.body.pictureUrl,
      };

      const result = await AuthService.signup(body);

      if (!result.success) {
        logger.warn('User signup failed', { email: body.email, message: result.message });
        return sendError(res, 400, result.message);
      }

      logger.info('User signed up successfully', { email: body.email });
      return sendSuccess(res, result.data, result.message, 201);
    } catch (err: any) {
      logger.error('User signup failed (unexpected)', { error: err });
      return sendError(res, 500, 'Internal server error during signup');
    }
  },

  // -------------------------
  // Authenticate/Login (legacy-safe)
  // -------------------------
  async authenticate(req: Request, res: Response) {
    try {
      const body = {
        emailOrUsername: (
          req.body.EmailOrUsername ??
          req.body.emailOrUsername ??
          req.body.email
        )?.toLowerCase(),
        password: req.body.Password ?? req.body.password,
        mobileChannel: req.body.MobileChannel ?? req.body.mobileChannel,
      };

      const result = await AuthService.authenticatev1(body);

      if (!result.success) {
        logger.warn('Authentication failed', {
          emailOrUsername: body.emailOrUsername,
          message: result.message,
        });
        return sendError(res, 400, result.message);
      }

      logger.info('Authentication successful', { emailOrUsername: body.emailOrUsername });
      return sendSuccess(res, result.data, result.message, 200);
    } catch (err: any) {
      logger.error('Authentication failed (unexpected)', { error: err });
      return sendError(res, 500, 'Internal server error during authentication');
    }
  },

  // -------------------------
  // Logout (blacklist token)
  // -------------------------
  async logout(req: AuthenticatedRequest, res: Response) {
    try {
      const token = req.headers.authorization?.split(' ')[1];
      const userId = req.user?.userId ?? req.body.UserId ?? req.body.userId;

      if (!userId) return sendError(res, 401, 'User ID missing');
      if (!token) return sendError(res, 400, 'Token is required');

      await TokenBlacklist.create({ token });
      const result = await AuthService.logout({ userId, token });

      if (!result.success) return sendError(res, 400, result.message);
      return sendSuccess(res, undefined, result.message, 200);
    } catch (err: any) {
      logger.error('Logout failed', { error: err });
      return sendError(res, 500, 'Internal server error during logout');
    }
  },

  // -------------------------
  // Change password
  // -------------------------
  async changePassword(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const formerPassword = req.body.FormerPassword ?? req.body.formerPassword;
      const newPassword = req.body.NewPassword ?? req.body.newPassword;

      if (!userId) return sendError(res, 401, 'User ID missing');
      if (!formerPassword || !newPassword)
        return sendError(res, 401, 'Former password or New password is missing');

      const result = await AuthService.changePassword(userId, formerPassword, newPassword);

      if (!result.success) return sendError(res, 401, result.message);

      return sendSuccess(res, undefined, result.message, 200);
    } catch (err: any) {
      logger.error('Password change failed', { error: err });
      return sendError(res, 500, 'Internal server error during logout');
    }
  },

  // -------------------------
  // Send password reset token
  // -------------------------
  async sendPasswordToken(req: Request, res: Response) {
    try {
      const email = req.body.Email ?? req.body.email ?? req.query.email;
      if (!email) return sendError(res, 400, 'Email is required');

      const result = await AuthService.sendPasswordResetToken({ email });
      const data = result.otp ? { otp: result.otp } : undefined;

      return sendSuccess(res, data, result.message, 200);
    } catch (err: any) {
      logger.error('SendPasswordToken failed', { error: err });
      return sendError(res, 500, 'Internal server error');
    }
  },

  // -------------------------
  // Verify password reset OTP
  // -------------------------
  async verifyResetOtp(req: Request, res: Response) {
    try {
      const email = req.body.Email ?? req.body.email ?? req.query.email;
      const otp = req.body.Otp ?? req.body.otp ?? req.query.otp;
      if (!email || !otp) return sendError(res, 400, 'Email and OTP are required');

      const result = await AuthService.verifyResetOtp({ email, otp });
      if (!result?.success) return sendError(res, 400, result.message);

      return sendSuccess(res, { token: result.token }, result.message, 200);
    } catch (err: any) {
      logger.error('VerifyResetOtp failed', { error: err });
      return sendError(res, 500, 'Internal server error');
    }
  },

  // -------------------------
  // Reset password (legacy-safe)
  // -------------------------
  async resetPassword(req: Request, res: Response) {
    try {
      const token = req.body.Token ?? req.body.token ?? req.query.token;
      const newPassword =
        req.body.NewPassword ?? req.body.newPassword ?? req.body.ConfirmNewPassword;

      if (!token || !newPassword)
        return sendError(res, 400, 'Token and password are required');

      const result = await AuthService.resetPassword({token, newPassword});
      await TokenBlacklist.create({ token });

      return sendSuccess(res, undefined, result.message, 200);
    } catch (err: any) {
      logger.error('ResetPassword failed', { error: err });
      return sendError(res, 400, err.message);
    }
  },

  // -------------------------
  // Username exists
  // -------------------------
  async usernameAlreadyExists(req: Request, res: Response) {
    try {
      const username = (req.query.Username ?? req.query.username) as string;
      if (!username) return sendError(res, 400, 'Username is required');

      const exists = await AuthService.usernameAlreadyExists(username);
      return res.status(200).json({ exists });
    } catch (err: any) {
      logger.error('usernameAlreadyExists failed', { error: err });
      return sendError(res, 500, err.message);
    }
  },

  // -------------------------
  // Validate email
  // -------------------------
  async isValidEmail(req: Request, res: Response) {
    try {
      const body = req.body ?? {};
      const email = body.Email ?? body.email ?? req.query.Email ?? req.query.email;
      if (!email) return sendError(res, 400, 'Email is required');

      const isValid = await AuthService.isValidEmail(email);
      return res.status(200).json({ isValid });
    } catch (err: any) {
      logger.error('isValidEmail failed', { error: err });
      return sendError(res, 500, err.message);
    }
  },
};
