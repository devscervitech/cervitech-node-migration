import OtpCode from '../models/OtpCode';
import { HashUtil } from '../utils/hash';
import { OTP_CONFIG, generateOtpCode } from '../utils/otp.util';
import { EmailUtils } from '../utils/EmailService/emailutils';
import { logger } from '../utils/logger';

const GENERIC_RESET_MESSAGE =
  'If the account exists, a password reset code has been sent to the email';
const OTP_PURPOSE = 'password_reset';
const OTP_DEBUG = process.env.OTP_DEBUG === 'true';

export class OtpService {
  static genericMessage() {
    return GENERIC_RESET_MESSAGE;
  }

  static async issueResetCode(email: string, username: string): Promise<{ code?: string }> {
    const normalized = email.toLowerCase().trim();

    const recent = await OtpCode.findOne({
      email: normalized,
      purpose: OTP_PURPOSE,
      createdAt: { $gt: new Date(Date.now() - OTP_CONFIG.resendCooldownSeconds * 1000) },
    });
    if (recent) return {};

    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentCount = await OtpCode.countDocuments({
      email: normalized,
      purpose: OTP_PURPOSE,
      createdAt: { $gt: hourAgo },
    });
    if (recentCount >= OTP_CONFIG.hourlyCap) return {};

    const code = generateOtpCode();
    const hashed = await HashUtil.hash(code);

    await OtpCode.deleteMany({ email: normalized, purpose: OTP_PURPOSE });
    await OtpCode.create({
      email: normalized,
      code: hashed,
      purpose: OTP_PURPOSE,
      attempts: 0,
      expiresAt: new Date(Date.now() + OTP_CONFIG.expiryMinutes * 60 * 1000),
    });

    try {
      await EmailUtils.sendPasswordResetOtpEmail(normalized, username, code);
    } catch (err: any) {
      logger.error('Failed to send OTP email', { error: err.message });
      throw new Error('Failed to send password reset email');
    }

    return OTP_DEBUG ? { code } : {};
  }

  static async verifyResetCode(email: string, otp: string): Promise<void> {
    const normalized = email.toLowerCase().trim();

    const record = await OtpCode.findOne({
      email: normalized,
      purpose: OTP_PURPOSE,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (!record) throw new Error('Invalid or expired OTP');

    const valid = await HashUtil.compare(otp, record.code);
    if (!valid) {
      record.attempts += 1;
      if (record.attempts >= OTP_CONFIG.maxAttempts) {
        await OtpCode.deleteOne({ _id: record._id });
      } else {
        await record.save();
      }
      throw new Error('Invalid or expired OTP');
    }

    await OtpCode.deleteOne({ _id: record._id });
  }
}
