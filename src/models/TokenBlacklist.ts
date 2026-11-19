
import { Schema, model } from 'mongoose';

interface ITokenBlacklist {
  token: string;
  createdAt: Date;
  expiresAt: Date;
}

const TokenBlacklistSchema = new Schema<ITokenBlacklist>({
  token: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true, expires: 0 }
});

const TokenBlacklist = model<ITokenBlacklist>('TokenBlacklist', TokenBlacklistSchema);
export default TokenBlacklist;
