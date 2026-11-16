import jwt from "jsonwebtoken";
import { IAppUser } from "../models/AppUser";
import { IBackofficeUser } from "../models/BackOfficeUser";
import AppUser from "../models/AppUser"; 
import BackofficeUser from "../models/BackOfficeUser";
import dotenv from "dotenv";
dotenv.config();

function requiredSecret(name: string): string {
  const value = process.env[name];
  if (!value?.trim()) throw new Error(`Missing required signing secret: ${name}`);
  return value;
}
const APP_USER_SECRET = requiredSecret('APP_USER_JWT_SECRET');
const BACKOFFICE_SECRET = requiredSecret('BACKOFFICE_JWT_SECRET');
const GENERAL_TOKEN_SECRET = requiredSecret('GENERAL_TOKEN_SECRET');
export class InvalidTokenError extends Error {}

export interface BaseTokenPayload {
  userId: string;
  role?: "APP_USER" | "BACKOFFICE_USER";
  username?: string;
  email?: string;
  accessLevel?: string;
  iat?: number;
  exp?: number;
}

export type GeneralTokenPurpose = "password_reset" | "account_deletion";

export class TokenUtil {
  // 🔹 App User Auth Token
  static generateAppUserToken(user: IAppUser): string {
    const payload: BaseTokenPayload = {
      userId: String(user._id),
      role: "APP_USER",
      username: user.username,
      email: user.email,
    };
    return jwt.sign(payload, APP_USER_SECRET, { expiresIn: "2h" });
  }

  // 🔹 Backoffice Auth Token
  static generateBackofficeUserToken(user: IBackofficeUser): string {
    const payload: BaseTokenPayload = {
      userId: String(user._id),
      role: "BACKOFFICE_USER",
      username: user.username,
      email: user.email,
      accessLevel: user.accessLevel,
    };
    return jwt.sign(payload, BACKOFFICE_SECRET, { expiresIn: "2h" });
  }

  // General-purpose Token (for password reset, account deletion, etc.)
  static generateToken(identifier: string, purpose: GeneralTokenPurpose, email?: string, realm: "APP_USER" | "BACKOFFICE_USER" = "APP_USER"): string {
  const payload: { userId: string; purpose: GeneralTokenPurpose; email?: string } = {
    userId: identifier,
    purpose,
  };
  if (email) payload.email = email;
  return jwt.sign(payload, GENERAL_TOKEN_SECRET, { expiresIn: "30m", audience: `${realm}:${purpose}` });
}

static verifyToken(
  token: string,
  expectedPurpose: GeneralTokenPurpose,
  realm: "APP_USER" | "BACKOFFICE_USER" = "APP_USER"
): { userId: string; purpose: GeneralTokenPurpose; email?: string } {
  let decoded: { userId: string; purpose?: GeneralTokenPurpose; email?: string };
  try {
    decoded = jwt.verify(token, GENERAL_TOKEN_SECRET, { audience: `${realm}:${expectedPurpose}` }) as {
      userId: string;
      purpose?: GeneralTokenPurpose;
      email?: string;
    };
  } catch {
    throw new Error("Invalid or expired general token");
  }

  if (decoded.purpose !== expectedPurpose) {
    throw new Error("Token is not valid for this operation");
  }

  return decoded as { userId: string; purpose: GeneralTokenPurpose; email?: string };
}

static async verifyUserToken(token: string): Promise<BaseTokenPayload> {
  let payload: BaseTokenPayload;
  try {
    const decoded = jwt.decode(token) as BaseTokenPayload | null;
    if (!decoded || !['APP_USER', 'BACKOFFICE_USER'].includes(decoded.role!)) {
      throw new Error('Invalid role');
    }
    payload = jwt.verify(token, decoded.role === 'BACKOFFICE_USER' ? BACKOFFICE_SECRET : APP_USER_SECRET) as BaseTokenPayload;
    if (!payload.userId) throw new Error('Missing user ID');
  } catch {
    throw new InvalidTokenError('Invalid or expired token');
  }
  const user = payload.role === 'APP_USER'
    ? await AppUser.findById(payload.userId)
    : await BackofficeUser.findById(payload.userId);
  if (!user || user.deleted) throw new InvalidTokenError('Invalid or expired token');
  return payload;
}
}
