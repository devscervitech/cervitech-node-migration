import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import type { IAppUser } from "../models/AppUser";
import type { IBackofficeUser } from "../models/BackOfficeUser";
import AppUser from "../models/AppUser";
import BackofficeUser from "../models/BackOfficeUser";
import dotenv from "dotenv";
dotenv.config();

// Secrets
const APP_USER_SECRET = process.env.APP_USER_JWT_SECRET || "appuser-secret-key";
const BACKOFFICE_SECRET = process.env.BACKOFFICE_JWT_SECRET || "backoffice-secret-key";
const GENERAL_TOKEN_SECRET = process.env.GENERAL_TOKEN_SECRET || "general-secret-key";

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

export type UserTokenRole = "APP_USER" | "BACKOFFICE_USER";

/** True only for the two roles this API issues user tokens for. */
export function isUserTokenRole(role: unknown): role is UserTokenRole {
  return role === "APP_USER" || role === "BACKOFFICE_USER";
}

/**
 * Minimal, validated view of the account a verified user token belongs to.
 * Built from raw stored values (no schema defaults or result casting).
 * accessLevel is retained as a claim for compatibility; authorization uses
 * the current database value returned in this account view.
 */
export type AuthenticatedAccount =
  | {
      role: "APP_USER";
      userId: string;
      username?: string;
      email?: string;
    }
  | {
      role: "BACKOFFICE_USER";
      userId: string;
      username?: string;
      email?: string;
      accessLevel?: string;
      /** true unless the stored value is exactly boolean false (fail closed). */
      readOnly: boolean;
    };

const asOptionalString = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

/**
 * Raw stored `deleted` values that count as "not deleted": absent/null, or a
 * value Mongoose's Boolean cast maps to false. This keeps the outcome the
 * previously hydrated document produced for every castable value, and rejects
 * anything Mongoose could not cast (fail closed).
 */
const isStoredNotDeleted = (value: unknown): boolean =>
  value == null || mongoose.Schema.Types.Boolean.convertToFalse.has(value);

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
  static generateToken(identifier: string, purpose: GeneralTokenPurpose, email?: string): string {
  const payload: { userId: string; purpose: GeneralTokenPurpose; email?: string } = {
    userId: identifier,
    purpose,
  };
  if (email) payload.email = email;
  return jwt.sign(payload, GENERAL_TOKEN_SECRET, { expiresIn: "30m" });
}

static verifyToken(
  token: string,
  expectedPurpose: GeneralTokenPurpose
): { userId: string; purpose: GeneralTokenPurpose; email?: string } {
  let decoded: { userId: string; purpose?: GeneralTokenPurpose; email?: string };
  try {
    decoded = jwt.verify(token, GENERAL_TOKEN_SECRET) as {
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
  const { payload } = await TokenUtil.verifyUserTokenWithAccount(token);
  return payload;
}

/**
 * Verifies a user token and returns the verified payload together with a
 * minimal record of the current account. Callers that make authorization
 * decisions (e.g. back-office readOnly) must use the account, not the claims.
 * Performs the same single findById lookup verifyUserToken always did, but
 * reads only the needed fields as raw stored values (lean, no defaults).
 */
static async verifyUserTokenWithAccount(
  token: string
): Promise<{ payload: BaseTokenPayload; account: AuthenticatedAccount }> {
  try {
    const decoded = jwt.decode(token) as BaseTokenPayload | null;
    if (!decoded || !isUserTokenRole(decoded.role)) throw new Error("Invalid token structure");

    const secret =
      decoded.role === "BACKOFFICE_USER" ? BACKOFFICE_SECRET : APP_USER_SECRET;

    const payload = jwt.verify(token, secret) as BaseTokenPayload;
    if (payload.role !== decoded.role) throw new Error("Invalid token structure");

    if (payload.role === "APP_USER") {
      const user = await AppUser.findById(payload.userId)
        .select("username email deleted")
        .lean<Record<string, unknown>>();

      if (!user) throw new Error("User not found");
      // ✅ Check if the user is deleted
      if (!isStoredNotDeleted(user.deleted)) throw new Error("User account is deleted");

      return {
        payload,
        account: {
          role: "APP_USER",
          userId: String(user._id),
          username: asOptionalString(user.username),
          email: asOptionalString(user.email),
        },
      };
    }

    const user = await BackofficeUser.findById(payload.userId)
      .select("username email accessLevel readOnly")
      .lean<Record<string, unknown>>();

    if (!user) throw new Error("User not found");
    // BackofficeUser has no `deleted` path; it was never a rejection reason.

    return {
      payload,
      account: {
        role: "BACKOFFICE_USER",
        userId: String(user._id),
        username: asOptionalString(user.username),
        email: asOptionalString(user.email),
        accessLevel: asOptionalString(user.accessLevel),
        readOnly: user.readOnly !== false,
      },
    };
  } catch (err) {
    throw new Error("Invalid or expired token");
  }
}

}
