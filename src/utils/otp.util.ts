import { randomInt } from 'node:crypto';

export const OTP_CONFIG = {
  codeLength: 6,
  expiryMinutes: 10,
  maxAttempts: 5,
  resendCooldownSeconds: 60,
  hourlyCap: 5,
};

export function generateOtpCode(): string {
  return randomInt(0, Math.pow(10, OTP_CONFIG.codeLength))
    .toString()
    .padStart(OTP_CONFIG.codeLength, '0');
}
