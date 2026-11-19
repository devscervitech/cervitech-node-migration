import { revokeToken } from '../utils/revokeToken';
import BackofficeUser, { IBackofficeUser } from "../models/BackOfficeUser";
import { backOfficeUserModel } from "../types/backOfficeUserModel.types";
import { HashUtil } from "../utils/hash";
import { TokenUtil } from "../utils/token.util";
import TokenBlacklist from "../models/TokenBlacklist";
import { OtpService } from "./otp.service";

class BackofficeUserService {
  /** Create new backoffice user */
  static async create(dto: backOfficeUserModel) {
    const hashedPassword = await HashUtil.hash(dto.password);

    const user = new BackofficeUser({
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
      telephone: dto.telephone,
      username: dto.username,
      password: hashedPassword,
      accessLevel: dto.accessLevel,
      readOnly: dto.readOnly ?? false,
    });

    return await user.save();
  }

  /**user login */
  static async loginService(username: string, password: string) {
    const user = await BackofficeUser.findOne({ username });
    if (!user) throw new Error("Invalid username or password");

    const isValid = await HashUtil.compare(password, user.password);
    if (!isValid) throw new Error("Invalid username or password");

    const token = TokenUtil.generateBackofficeUserToken(user);
    return { user, token };
  }

  /** Logout user by blacklisting token */
  static async logoutService(token: string) {
    if (!token) throw new Error("Token required for logout");

    const existing = await TokenBlacklist.findOne({ token });
    if (!existing) {
      await revokeToken(token);
    }

    return { success: true, message: "User logged out successfully" };
  }

  /** Change password directly (authenticated users) */
  static async changePassword(userId: string, newPassword: string) {
    const user = await BackofficeUser.findById(userId);
    if (!user) throw new Error("User not found");

    user.password = await HashUtil.hash(newPassword);
    await user.save();

    return { userId, success: true };
  }

  static async sendPasswordResetToken(email: string) {
    const user = await BackofficeUser.findOne({ email });
    if (!user) {
      return { email, message: OtpService.genericMessage() };
    }

    const { code } = await OtpService.issueResetCode(user.email, user.username);

    return { email: user.email, message: OtpService.genericMessage(), otp: code };
  }

  static async verifyResetOtp(email: string, otp: string) {
    const user = await BackofficeUser.findOne({ email });
    if (!user) throw new Error("Invalid or expired OTP");

    await OtpService.verifyResetCode(email, otp);

    const resetToken = TokenUtil.generateToken(user._id.toString(), 'password_reset', undefined, 'BACKOFFICE_USER');

    return { token: resetToken, message: "OTP verified successfully" };
  }

  static async resetPassword(token: string, newPassword: string) {
    const blacklisted = await TokenBlacklist.findOne({ token });
    if (blacklisted) throw new Error("This token has already been used or is invalid");

    const { userId } = TokenUtil.verifyToken(token, 'password_reset', 'BACKOFFICE_USER');

    const user = await BackofficeUser.findById(userId);
    if (!user) throw new Error("Invalid or expired token");

    user.password = await HashUtil.hash(newPassword);
    await user.save();

    await revokeToken(token);

    return { success: true, message: "Password reset successfully" };
  }

  /** Fetch all users */
  static async getAll() {
    return await BackofficeUser.find();
  }

  /** Get user by username */
  static async getByUserName(username: string) {
    return await BackofficeUser.findOne({ username });
  }

  /** Get user by ID */
  static async getById(id: string) {
    return await BackofficeUser.findById(id);
  }

  /** Limit user query */
  static async getNumberOfBackOfficeUsers(limit: number) {
    if (limit <= 0) throw new Error("Specify a valid limit greater than zero");
    return await BackofficeUser.find().limit(limit);
  }

  /** Delete user by ID */
  static async deleteById(id: string) {
    return await BackofficeUser.findByIdAndDelete(id);
  }

  /** Update user */
  static async update(id: string, data: Partial<IBackofficeUser>) {
    const existingUser = await BackofficeUser.findById(id);
    if (!existingUser) throw new Error(`User with ID ${id} not found`);

    return await BackofficeUser.findByIdAndUpdate(id, data, { new: true });
  }
}

export default BackofficeUserService;
