import jwt from 'jsonwebtoken';
import TokenBlacklist from '../models/TokenBlacklist';

// Call only after token authentication/verification.
export async function revokeToken(token: string): Promise<void> {
  const payload = jwt.decode(token);
  if (!payload || typeof payload === 'string' || !Number.isFinite(payload.exp)) {
    throw new Error('Token must have an expiry');
  }
  const expiresAt = new Date(payload.exp! * 1000);
  try {
    await TokenBlacklist.updateOne({ token }, { $setOnInsert: { token, expiresAt } }, { upsert: true });
  } catch (error: any) {
    if (error?.code !== 11000) throw error;
  }
}
