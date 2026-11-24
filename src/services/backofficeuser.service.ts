import { revokeToken } from '../utils/revokeToken';
import BackofficeUser from "../models/BackOfficeUser";
import BackofficeSecurityState, {
  ACTIVE_BACKOFFICE_ADMIN_STATE_ID,
} from "../models/BackofficeSecurityState";
import type { IBackofficeUser } from "../models/BackOfficeUser";
import type { backOfficeUserModel } from "../types/backOfficeUserModel.types";
import { HashUtil } from "../utils/hash";
import { TokenUtil } from "../utils/token.util";
import TokenBlacklist from "../models/TokenBlacklist";
import { OtpService } from "./otp.service";
import { logger } from "../utils/logger";
import { normalizePassword, verifyPasswordInput } from "../utils/password.util";
import { BACKOFFICE_ACCESS_LEVEL } from "../enums/backofficeAccessLevel";

type BackofficeProfileUpdate = Partial<
  Pick<IBackofficeUser, "firstName" | "lastName" | "email" | "telephone">
>;
type BackofficeAccessUpdate = Partial<Pick<IBackofficeUser, "accessLevel" | "readOnly">>;

type BackofficeDeleteResult =
  | { status: "deleted" }
  | { status: "not_found" }
  | { status: "self_modification" }
  | { status: "not_admin" }
  | { status: "not_writable" }
  | { status: "admin_mutation_busy" }
  | { status: "last_writable" }
  | { status: "last_admin" };

type BackofficeAccessResult =
  | { status: "updated"; user: IBackofficeUser }
  | { status: "not_found" }
  | { status: "self_modification" }
  | { status: "not_admin" }
  | { status: "not_writable" }
  | { status: "admin_mutation_busy" }
  | { status: "last_writable" }
  | { status: "last_admin" };

type BackofficePasswordChangeResult =
  | { status: "changed" }
  | { status: "invalid_new_password" }
  | { status: "not_found" }
  | { status: "incorrect_current_password" };

const SAFE_BACKOFFICE_USER_FIELDS =
  "_id firstName lastName email telephone username accessLevel readOnly dateRegistered";

export class BackofficeAdminMutationBusyError extends Error {
  constructor() {
    super("Back-office account security changes are already in progress");
    this.name = "BackofficeAdminMutationBusyError";
  }
}

async function ensureAdminCountState() {
  let state = await BackofficeSecurityState.findById(ACTIVE_BACKOFFICE_ADMIN_STATE_ID).lean();
  if (state) return state;

  const activeAdminCount = await BackofficeUser.countDocuments({
    accessLevel: BACKOFFICE_ACCESS_LEVEL.ADMIN,
    readOnly: false,
  });

  try {
    await BackofficeSecurityState.updateOne(
      { _id: ACTIVE_BACKOFFICE_ADMIN_STATE_ID },
      { $setOnInsert: { activeAdminCount, adminMutationLocked: false } },
      { upsert: true }
    );
  } catch (error: any) {
    // Concurrent first-time initializers can race on the singleton _id.
    if (error?.code !== 11000) throw error;
  }

  state = await BackofficeSecurityState.findById(ACTIVE_BACKOFFICE_ADMIN_STATE_ID).lean();
  if (!state) throw new Error("Could not initialize the back-office admin invariant");
  return state;
}

async function getActiveAdminCount(): Promise<number> {
  return BackofficeUser.countDocuments({
    accessLevel: BACKOFFICE_ACCESS_LEVEL.ADMIN,
    readOnly: false,
  });
}

async function syncActiveAdminCount() {
  const activeAdminCount = await getActiveAdminCount();
  await BackofficeSecurityState.updateOne(
    { _id: ACTIVE_BACKOFFICE_ADMIN_STATE_ID },
    { $set: { activeAdminCount } },
    { upsert: true }
  );
}

async function withAdminMutationLock<T>(operation: () => Promise<T>): Promise<T> {
  await ensureAdminCountState();

  const lock = await BackofficeSecurityState.findOneAndUpdate(
    {
      _id: ACTIVE_BACKOFFICE_ADMIN_STATE_ID,
      $or: [
        { adminMutationLocked: false },
        { adminMutationLocked: { $exists: false } },
      ],
    },
    { $set: { adminMutationLocked: true } },
    { new: true }
  );
  if (!lock) throw new BackofficeAdminMutationBusyError();

  try {
    return await operation();
  } finally {
    try {
      await syncActiveAdminCount();
    } catch (error: any) {
      logger.error("Failed to synchronize back-office admin invariant count", {
        error: error?.message ?? "Unknown error",
      });
    }
    try {
      await BackofficeSecurityState.updateOne(
        { _id: ACTIVE_BACKOFFICE_ADMIN_STATE_ID, adminMutationLocked: true },
        { $set: { adminMutationLocked: false } }
      );
    } catch (error: any) {
      logger.error("Failed to release back-office admin mutation lock", {
        error: error?.message ?? "Unknown error",
      });
    }
  }
}

function isActiveAdmin(user: { accessLevel?: unknown; readOnly?: unknown }): boolean {
  return (
    user.accessLevel === BACKOFFICE_ACCESS_LEVEL.ADMIN &&
    user.readOnly === false
  );
}

async function findSecurityActor(actorId: string) {
  return BackofficeUser.findById(actorId)
    .select("_id accessLevel readOnly")
    .lean<Record<string, unknown>>();
}

async function updateAccessWhileLocked(
  id: string,
  actorId: string,
  data: BackofficeAccessUpdate
): Promise<BackofficeAccessResult> {
  const [actor, target] = await Promise.all([
    findSecurityActor(actorId),
    BackofficeUser.findById(id)
      .select("_id accessLevel readOnly")
      .lean<Record<string, unknown>>(),
  ]);

  if (!actor || actor.accessLevel !== BACKOFFICE_ACCESS_LEVEL.ADMIN) {
    return { status: "not_admin" };
  }
  if (actor.readOnly !== false) return { status: "not_writable" };
  if (!target) return { status: "not_found" };
  if (String(actor._id) === String(target._id)) return { status: "self_modification" };

  const removesActiveAdmin =
    isActiveAdmin(target) &&
    ((data.accessLevel !== undefined &&
      data.accessLevel !== BACKOFFICE_ACCESS_LEVEL.ADMIN) ||
      data.readOnly === true);

  const addsActiveAdmin =
    !isActiveAdmin(target) &&
    (data.accessLevel ?? target.accessLevel) === BACKOFFICE_ACCESS_LEVEL.ADMIN &&
    (data.readOnly ?? target.readOnly) === false;

  if (data.readOnly === true && target.readOnly === false) {
    const writableCount = await BackofficeUser.countDocuments({ readOnly: false });
    if (writableCount <= 1) return { status: "last_writable" };
  }

  if (removesActiveAdmin && (await getActiveAdminCount()) <= 1) {
    return { status: "last_admin" };
  }

  const update: BackofficeAccessUpdate = {};
  if (data.accessLevel !== undefined) update.accessLevel = data.accessLevel;
  if (data.readOnly !== undefined) update.readOnly = data.readOnly;

  const user = await BackofficeUser.findByIdAndUpdate(id, update, {
    new: true,
    runValidators: true,
  });

  if (!user) return { status: "not_found" };
  return { status: "updated", user };
}

class BackofficeUserService {
  /** Create new backoffice user */
  static async create(dto: backOfficeUserModel) {
    const normalizedPassword = normalizePassword(dto.password);
    if (!normalizedPassword) throw new Error("Password is required");
    const hashedPassword = await HashUtil.hash(normalizedPassword);

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

    if (isActiveAdmin(user)) {
      return withAdminMutationLock(() => user.save());
    }
    return user.save();
  }

  /**user login */
  static async loginService(username: string, password: string) {
    const user = await BackofficeUser.findOne({ username }).select("+password");
    if (!user?.password) throw new Error("Invalid username or password");

    const passwordCheck = await verifyPasswordInput(password, user.password);
    if (!passwordCheck.isValid) throw new Error("Invalid username or password");

    if (passwordCheck.needsRehash) {
      user.password = await HashUtil.hash(passwordCheck.normalizedPassword);
      await user.save();
    }

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
  static async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<BackofficePasswordChangeResult> {
    const normalizedNewPassword = normalizePassword(newPassword);
    if (!normalizedNewPassword) return { status: "invalid_new_password" };

    const user = await BackofficeUser.findById(userId).select("+password");
    if (!user) return { status: "not_found" };
    if (!user.password || !(await verifyPasswordInput(currentPassword, user.password)).isValid) {
      return { status: "incorrect_current_password" };
    }

    user.password = await HashUtil.hash(normalizedNewPassword);
    await user.save();

    return { status: "changed" };
  }

  static async sendPasswordResetToken(email: string) {
    try {
      const user = await BackofficeUser.findOne({ email });
      if (user) {
        // Never return the OTP, including when OTP_DEBUG is enabled.
        await OtpService.issueResetCode(user.email, user.username);
      }
    } catch (error) {
      // Keep the public response identical for unknown accounts and mail or
      // database failures. Operational details remain in server logs.
      logger.error("Backoffice password reset request failed", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }

    return { message: OtpService.genericMessage() };
  }

  static async verifyResetOtp(email: string, otp: string) {
    const user = await BackofficeUser.findOne({ email });
    if (!user) throw new Error("Invalid or expired OTP");

    await OtpService.verifyResetCode(email, otp);

    const resetToken = TokenUtil.generateToken(String(user._id), 'password_reset', undefined, 'BACKOFFICE_USER');

    return { token: resetToken, message: "OTP verified successfully" };
  }

  static async resetPassword(token: string, newPassword: string) {
    const normalizedPassword = normalizePassword(newPassword);
    if (!normalizedPassword) throw new Error("Password is required");

    const blacklisted = await TokenBlacklist.findOne({ token });
    if (blacklisted) throw new Error("This token has already been used or is invalid");

    const { userId } = TokenUtil.verifyToken(token, 'password_reset', 'BACKOFFICE_USER');

    const user = await BackofficeUser.findById(userId).select("+password");
    if (!user) throw new Error("Invalid or expired token");

    user.password = await HashUtil.hash(normalizedPassword);
    await user.save();

    await revokeToken(token);

    return { success: true, message: "Password reset successfully" };
  }

  /** Fetch all users */
  static async getAll() {
    return await BackofficeUser.find().select(SAFE_BACKOFFICE_USER_FIELDS);
  }

  /** Get user by username */
  static async getByUserName(username: string) {
    return await BackofficeUser.findOne({ username }).select(SAFE_BACKOFFICE_USER_FIELDS);
  }

  /** Get user by ID */
  static async getById(id: string) {
    return await BackofficeUser.findById(id).select(SAFE_BACKOFFICE_USER_FIELDS);
  }

  /** Limit user query */
  static async getNumberOfBackOfficeUsers(limit: number) {
    if (limit <= 0) throw new Error("Specify a valid limit greater than zero");
    return await BackofficeUser.find().select(SAFE_BACKOFFICE_USER_FIELDS).limit(limit);
  }

  /** Delete user by ID */
  static async deleteById(id: string, actorId: string): Promise<BackofficeDeleteResult> {
    const initialActor = await findSecurityActor(actorId);
    if (!initialActor || initialActor.accessLevel !== BACKOFFICE_ACCESS_LEVEL.ADMIN) {
      return { status: "not_admin" };
    }
    if (initialActor.readOnly !== false) return { status: "not_writable" };
    try {
      return await withAdminMutationLock(async () => {
        const [actor, target] = await Promise.all([
          findSecurityActor(actorId),
          BackofficeUser.findById(id)
            .select("_id accessLevel readOnly")
            .lean<Record<string, unknown>>(),
        ]);

        if (!actor || actor.accessLevel !== BACKOFFICE_ACCESS_LEVEL.ADMIN) {
          return { status: "not_admin" };
        }
        if (actor.readOnly !== false) return { status: "not_writable" };
        if (!target) return { status: "not_found" };
        if (String(actor._id) === String(target._id)) return { status: "self_modification" };

        if (target.readOnly === false) {
          const writableCount = await BackofficeUser.countDocuments({ readOnly: false });
          if (writableCount <= 1) return { status: "last_writable" };
        }

        if (isActiveAdmin(target) && (await getActiveAdminCount()) <= 1) {
          return { status: "last_admin" };
        }

        const deleted = await BackofficeUser.findByIdAndDelete(id).select("_id").lean();
        return deleted ? { status: "deleted" } : { status: "not_found" };
      });
    } catch (error) {
      if (error instanceof BackofficeAdminMutationBusyError) {
        return { status: "admin_mutation_busy" };
      }
      throw error;
    }
  }

  /** Update user */
  static async update(id: string, data: BackofficeProfileUpdate) {
    const update: BackofficeProfileUpdate = {};
    if (data.firstName !== undefined) update.firstName = data.firstName;
    if (data.lastName !== undefined) update.lastName = data.lastName;
    if (data.email !== undefined) update.email = data.email;
    if (data.telephone !== undefined) update.telephone = data.telephone;

    return await BackofficeUser.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
    });
  }

  /** Update privilege metadata without allowing self-demotion or last-admin removal. */
  static async updateAccess(
    id: string,
    actorId: string,
    data: BackofficeAccessUpdate
  ): Promise<BackofficeAccessResult> {
    const initialActor = await findSecurityActor(actorId);
    if (!initialActor || initialActor.accessLevel !== BACKOFFICE_ACCESS_LEVEL.ADMIN) {
      return { status: "not_admin" };
    }
    try {
      return await withAdminMutationLock(() => updateAccessWhileLocked(id, actorId, data));
    } catch (error) {
      if (error instanceof BackofficeAdminMutationBusyError) {
        return { status: "admin_mutation_busy" };
      }
      throw error;
    }
  }
}

export default BackofficeUserService;
