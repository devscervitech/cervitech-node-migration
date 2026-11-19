// src/models/BackofficeUser.ts
import mongoose, { Schema } from "mongoose";
import { IUser, UserSchema } from "./userFields";
import { BACKOFFICE_ACCESS_LEVELS, BackofficeAccessLevel } from "../enums/backofficeAccessLevel";

export interface IBackofficeUser extends IUser {
  resetToken?: string;
  resetTokenExpires?: Date;
  username: string;
  accessLevel: BackofficeAccessLevel;
  readOnly: boolean;
}

const BackofficeUserSchema: Schema = new Schema<IBackofficeUser>({
  ...UserSchema.obj,
  // Retain exclusions for legacy stored reset fields; new resets use OTP tokens.
  resetToken: { type: String, select: false },
  resetTokenExpires: { type: Date, select: false },
  // Hide hashes from ordinary queries. Authentication and password changes
  // explicitly opt in with `.select("+password")`.
  password: { type: String, required: true, select: false },
  username: { type: String, required: true, unique: true },
  accessLevel: { type: String, enum: BACKOFFICE_ACCESS_LEVELS, required: true },
  readOnly: { type: Boolean, default: false },
});

const BackofficeUser: mongoose.Model<IBackofficeUser> =
  (mongoose.models.BackofficeUser as mongoose.Model<IBackofficeUser> | undefined) ||
  mongoose.model<IBackofficeUser>("BackofficeUser", BackofficeUserSchema);

export default BackofficeUser;
