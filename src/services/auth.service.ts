import { revokeToken } from '../utils/revokeToken';
// ✅ Always include `.js` extensions for relative imports in Node16/ESM mode
import { HashUtil } from '../utils/hash.js';
import {
  SignupRequest,
  SignupResponse,
  PasswordResetTokenRequest,
  SendPasswordTokenResponse,
  PasswordResetResponse,
  PasswordResetRequest,
  VerifyOtpRequest,
  VerifyOtpResponse,
} from '../viewmodels/auth.viewmodel.js';
import {
  LoginResponse,
  LoginRequest,
  LoginResponseResult,
  LogoutRequest,
  LogoutResponse,
} from '../types/auth.types.js';
import { TokenUtil } from '../utils/token.util.js';
import { MOBILE_CHANNEL } from '../enums/mobileChannel.js';
import TokenBlacklist from '../models/TokenBlacklist.js';
import AppUser from '../models/AppUser.js';
import { logger } from '../utils/logger.js';
import { DateLibrary } from '../utils/dateLibrary.js';
import { OtpService } from './otp.service.js';
import { EmailUtils } from '../utils/EmailService/emailutils.js';
import { AuthValidation } from '../validation/authValidation.js';
import { getLatestGoal } from './goalLookup.service.js';
import { toAppUserViewModel } from '../viewmodels/AppUser.viewmodel.js';
import { normalizePassword, verifyPasswordInput } from '../utils/password.util.js';
import { passwordPolicySchema } from '../validation/schemas/auth.schema.js';

function formatValidationError(error: { details: Array<{ message: string }> }): string {
  return error.details.map(({ message }) => message.replace(/\"/g, '')).join('; ');
}

function escapeRegExpLiteral(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

type ChangePasswordResult =
  | { success: true; message: string }
  | { success: false; message: string; code?: 'INVALID_NEW_PASSWORD' };

export class AuthService {
  static async signup(data: SignupRequest): Promise<SignupResponse> {
    const validation = AuthValidation.signupValidation(data);
    if (!validation.valid) {
      return {
        success: false,
        message: validation.error,
      };
    }

    const { password, confirmPassword, ...userData } = validation.value;
    const existing = await AppUser.findOne({ email: userData.email });
    if (existing) {
      return {
        success: false,
        message: 'Email already in use',
      };
    }

    const normalizedPassword = normalizePassword(password);
    if (!normalizedPassword) {
      return { success: false, message: 'Password cannot be empty' };
    }
    const hashedPassword = await HashUtil.hash(normalizedPassword);
    const email = userData.email.toLowerCase().trim();

    try {
      const createdUser = await AppUser.create({
        ...userData,
        firstName: userData.firstName.trim(),
        lastName: userData.lastName.trim(),
        email,
        password: hashedPassword,
        username: userData.username,
        pictureUrl: userData.pictureUrl || '',
        fcmToken: userData.fcmToken || '',
        lastLoginDateTime: new Date(),
        allowPushNotifications: true,
        hasPaid: false,
        isGoalOn: false,
        responseRate: 0,
        neckAngleRecords: [],
        mobileChannel: userData.mobileChannel || MOBILE_CHANNEL.WEB,
        prompt: 5,
        notificationCount: 0,
        currentTargetedAverageNeckAngle: 0,
        dateRegistered: new Date(),
        deleted: false,
      });

      const userObj = createdUser.toObject();
      delete userObj.password;

      let mailResp;
      try {
        mailResp = await EmailUtils.sendSignupEmail(email, userData.username);
      } catch (error) {
        logger.warn('Signup email failed', { email, mailResp });
      }

      return {
        success: true,
        message: 'Signup successful',
        data: userObj,
      };
    } catch (error: any) {
      if (error.code === 11000) {
        const field = Object.keys(error.keyValue)[0];
        const value = error.keyValue[field];
        return {
          success: false,
          message: `${field} '${value}' is already taken`,
        };
      }

      logger.error(`Signup failed: ${error.message}`);
      return {
        success: false,
        message: 'Internal server error occurred during signup',
      };
    }
  }

  static async changePassword(
    userId: string,
    formerPassword: string,
    newPassword: string
  ): Promise<ChangePasswordResult> {
    const user = await AppUser.findById(userId);

    if (!user) {
      return { success: false, message: 'User does not exist in database' };
    }

    const password = user.password;
    const same = await verifyPasswordInput(formerPassword, password);

    if (!same.isValid) {
      return { success: false, message: 'Incorrect former password, Try again or RESET password' };
    }
    const passwordValidation = passwordPolicySchema.validate(newPassword, { abortEarly: false });
    if (passwordValidation.error) {
      return {
        success: false,
        code: 'INVALID_NEW_PASSWORD',
        message: formatValidationError(passwordValidation.error),
      };
    }
    const newPassHash = await HashUtil.hash(passwordValidation.value);

    await AppUser.findByIdAndUpdate(userId, { password: newPassHash });

    return { success: true, message: 'Password change Successful' };
  }

  static async sendPasswordResetToken({email}: PasswordResetTokenRequest): Promise<SendPasswordTokenResponse> {
    const user = await AppUser.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return { success: true, message: OtpService.genericMessage() };
    }

    const { code } = await OtpService.issueResetCode(user.email, user.username);

    return { success: true, message: OtpService.genericMessage(), otp: code };
  }

  static async verifyResetOtp({email, otp}: VerifyOtpRequest): Promise<VerifyOtpResponse> {
    const user = await AppUser.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return { success: false, message: 'Invalid or expired OTP' };
    }

    try {
      await OtpService.verifyResetCode(email, otp);
    } catch (err: any) {
      return { success: false, message: err.message || 'Invalid or expired OTP' };
    }

    const token = TokenUtil.generateToken(user._id.toString(), 'password_reset');

    return { success: true, message: 'OTP verified successfully', token };
  }

  static async resetPassword({token, newPassword}: PasswordResetRequest): Promise<PasswordResetResponse> {
    const blacklisted = await TokenBlacklist.findOne({ token });
    if (blacklisted) throw new Error('This token has already been used or is invalid');

    const { userId } = TokenUtil.verifyToken(token, 'password_reset');

    const passwordValidation = passwordPolicySchema.validate(newPassword, { abortEarly: false });
    if (passwordValidation.error) throw new Error(formatValidationError(passwordValidation.error));

    const hashed = await HashUtil.hash(passwordValidation.value);
    const updated = await AppUser.findByIdAndUpdate(userId, { password: hashed });
    if (!updated) throw new Error('User not found');

    await revokeToken(token);

    return { success: true, message: 'Password reset successfully' };
  }

  static async authenticatev1(model: LoginRequest): Promise<LoginResponseResult> {
    const validation = AuthValidation.loginValidation(model);
    if (!validation.valid) {
      return {
        success: false,
        message: validation.error,
      };
    }

    const { emailOrUsername, password, mobileChannel } = validation.value;

    const user = await AppUser.findOne({
      $or: [{ email: emailOrUsername }, { username: emailOrUsername }],
    });

    if (!user) {
      return {
        success: false,
        message: 'This account does not exist. Please check the email or username provided.',
      };
    }

    if (user.deleted) {
      return {
        success: false,
        message: 'This account has been deleted. Please contact support if you believe this is an error.',
      };
    }

    const passwordCheck = await verifyPasswordInput(password, user.password, model.password);
    if (!passwordCheck.isValid) {
      return {
        success: false,
        message: 'An incorrect password provided. Please check password and try again.',
      };
    }

    if (passwordCheck.needsRehash) {
      user.password = await HashUtil.hash(passwordCheck.normalizedPassword);
    }

    user.lastLoginDateTime = new Date();
    user.mobileChannel = mobileChannel;
    await user.save();

    const token = TokenUtil.generateAppUserToken(user);

    let currentTargetedAverageNeckAngle = 0;
    const lastSetGoal = await getLatestGoal(String(user._id));
    if (lastSetGoal) {
      currentTargetedAverageNeckAngle = lastSetGoal.targetedAverageNeckAngle;
    }

    return {
      success: true,
      message: 'Authentication successful',
      data: {
        ...toAppUserViewModel(user),
        notificationCount: user.notificationCount ?? 0,
        currentTargetedAverageNeckAngle,
        token,
      },
    };
  }

  static async logout(logoutInfo: LogoutRequest): Promise<LogoutResponse> {
    const { userId, token } = logoutInfo;

    const validationError = AuthValidation.logoutValidation(logoutInfo);
    if (validationError) {
      return {
        success: false,
        message: validationError,
      };
    }

    const user = await AppUser.findById(userId);
    if (!user) {
      return {
        success: false,
        message: 'User not found',
      };
    }

    try {
      await revokeToken(token);

      user.fcmToken = '';
      await user.save();

      return {
        success: true,
        message: 'Logout successful',
      };
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error('Unknown error');
      logger.error(`Logout failed: ${err.message}`);

      return {
        success: false,
        message: 'Internal server error during logout',
      };
    }
  }

  static async usernameAlreadyExists(username: string): Promise<boolean> {
    if (typeof username !== 'string') throw new TypeError('Username must be a string');
    const normalizedUsername = username.toLowerCase().trim();
    const exists = await AppUser.exists({
      username: { $regex: new RegExp(`^${escapeRegExpLiteral(normalizedUsername)}$`, 'i') },
    });
    return !!exists;
  }

  static async isValidEmail(email: string): Promise<boolean> {
    const trimmedEmail = email.trim();
    if (trimmedEmail.endsWith('.')) return false;
    try {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(trimmedEmail);
    } catch {
      return false;
    }
  }
}
