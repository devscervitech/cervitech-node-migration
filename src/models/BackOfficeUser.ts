// src/models/BackofficeUser.ts
import mongoose, { Schema } from "mongoose";
import { IUser, UserSchema } from "./User";

export interface IBackofficeUser extends IUser {
  username: string;
  accessLevel: string;
  readOnly: boolean;
  resetToken?: string;
  resetTokenExpires?: Date;
}

const BackofficeUserSchema: Schema = new Schema<IBackofficeUser>({
  ...UserSchema.obj,
  password: { type: String, required: false }, 
  username: { type: String, required: true, unique: true },
  accessLevel: { type: String, required: true },
  readOnly: { type: Boolean, default: false },
  resetToken: { type: String },
  resetTokenExpires: { type: Date },
});

const BackofficeUser =
  mongoose.models.BackofficeUser ||
  mongoose.model<IBackofficeUser>("BackofficeUser", BackofficeUserSchema);

export default BackofficeUser;
