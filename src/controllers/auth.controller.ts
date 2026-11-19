import { revokeToken } from '../utils/revokeToken';
import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { TokenUtil } from '../utils/token.util';
import TokenBlacklist from '../models/TokenBlacklist';
import { logger } from '../utils/logger';
import { sendSuccess, sendError } from '../utils/apiResponse';
import {
  appUserChangePasswordSchema,
  appUserResetPasswordSchema,
  appUserResetRequestSchema,
  appUserVerifyResetOtpSchema,
  usernameExistsQuerySchema,
  emailValidationQuerySchema,
} from '../validation/schemas/auth.schema';

function validationMessage(error: { details: Array<{ message: string }> }): string {
  return error.details.map(({ message }) => message.replace(/\"/g, '')).join('; ');
}

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
      logger.error('User signup failed (unexpected)', { error: err.message });
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
      logger.error('Authentication failed (unexpected)', { error: err.message });
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

      const result = await AuthService.logout({ userId, token });

      if (!result.success) return sendError(res, 400, result.message);
      return sendSuccess(res, undefined, result.message, 200);
    } catch (err: any) {
      logger.error('Logout failed', { error: err.message });
      return sendError(res, 500, 'Internal server error during logout');
    }
  },

  // -------------------------
  // Change password
  // -------------------------
  async changePassword(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const body = req.body ?? {};
      const validation = appUserChangePasswordSchema.validate(
        {
          formerPassword: body.FormerPassword ?? body.formerPassword,
          newPassword: body.NewPassword ?? body.newPassword,
        },
        { abortEarly: false, allowUnknown: false }
      );

      if (!userId) return sendError(res, 401, 'User ID missing');
      if (validation.error) return sendError(res, 400, validationMessage(validation.error));

      const result = await AuthService.changePassword(
        userId,
        validation.value.formerPassword,
        validation.value.newPassword
      );

      if (!result.success) {
        return sendError(res, result.code === 'INVALID_NEW_PASSWORD' ? 400 : 401, result.message);
      }

      return sendSuccess(res, undefined, result.message, 200);
    } catch (err: any) {
      logger.error('Password change failed', { error: err.message });
      return sendError(res, 500, 'Internal server error during logout');
    }
  },

  // -------------------------
  // Send password reset token
  // -------------------------
  async sendPasswordToken(req: Request, res: Response) {
    try {
      const body = req.body ?? {};
      const validation = appUserResetRequestSchema.validate(
        { email: body.Email ?? body.email ?? req.query.email },
        { abortEarly: false, allowUnknown: false }
      );
      if (validation.error) return sendError(res, 400, validationMessage(validation.error));

      const result = await AuthService.sendPasswordResetToken(validation.value);
      const data = result.otp ? { otp: result.otp } : undefined;

      return sendSuccess(res, data, result.message, 200);
    } catch (err: any) {
      logger.error('SendPasswordToken failed', { error: err.message });
      return sendError(res, 500, 'Internal server error');
    }
  },

  // -------------------------
  // Verify password reset OTP
  // -------------------------
  async verifyResetOtp(req: Request, res: Response) {
    try {
      const body = req.body ?? {};
      const validation = appUserVerifyResetOtpSchema.validate(
        {
          email: body.Email ?? body.email ?? req.query.email,
          otp: body.Otp ?? body.otp ?? req.query.otp,
        },
        { abortEarly: false, allowUnknown: false }
      );
      if (validation.error) return sendError(res, 400, validationMessage(validation.error));

      const result = await AuthService.verifyResetOtp(validation.value);
      if (!result?.success) return sendError(res, 400, result.message);

      return sendSuccess(res, { token: result.token }, result.message, 200);
    } catch (err: any) {
      logger.error('VerifyResetOtp failed', { error: err.message });
      return sendError(res, 500, 'Internal server error');
    }
  },

  // -------------------------
  // Reset password (legacy-safe)
  // -------------------------
  async resetPassword(req: Request, res: Response) {
    try {
      const body = req.body ?? {};
      const validation = appUserResetPasswordSchema.validate(
        {
          token: body.Token ?? body.token ?? req.query.token,
          newPassword: body.NewPassword ?? body.newPassword ?? body.ConfirmNewPassword,
        },
        { abortEarly: false, allowUnknown: false }
      );
      if (validation.error) return sendError(res, 400, validationMessage(validation.error));

      const result = await AuthService.resetPassword(validation.value);

      return sendSuccess(res, undefined, result.message, 200);
    } catch (err: any) {
      logger.error('ResetPassword failed', { error: err.message });
      return sendError(res, 400, err.message);
    }
  },

  // -------------------------
  // Username exists
  // -------------------------
  async usernameAlreadyExists(req: Request, res: Response) {
    try {
      const validation = usernameExistsQuerySchema.validate(
        { username: req.query.Username ?? req.query.username },
        { abortEarly: false, allowUnknown: false }
      );
      if (validation.error) return sendError(res, 400, validationMessage(validation.error));

      const exists = await AuthService.usernameAlreadyExists(validation.value.username);
      return sendSuccess(res, { exists }, 'Username availability checked.', 200);
    } catch (err: any) {
      logger.error('usernameAlreadyExists failed', { error: err.message });
      return sendError(res, 500, 'Unable to check username availability.');
    }
  },

  // -------------------------
  // Validate email
  // -------------------------
  async isValidEmail(req: Request, res: Response) {
    try {
      const body = req.body ?? {};
      const validation = emailValidationQuerySchema.validate(
        { email: body.Email ?? body.email ?? req.query.Email ?? req.query.email },
        { abortEarly: false, allowUnknown: false }
      );
      if (validation.error) return sendError(res, 400, validationMessage(validation.error));

      const isValid = await AuthService.isValidEmail(validation.value.email);
      return sendSuccess(res, { isValid }, 'Email validation completed.', 200);
    } catch (err: any) {
      logger.error('isValidEmail failed', { error: err.message });
      return sendError(res, 500, 'Unable to validate email.');
    }
  },
};
