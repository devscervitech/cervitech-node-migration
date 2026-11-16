// src/models/BackofficeUser.ts
import mongoose, { Schema } from "mongoose";
import { IUser, UserSchema } from "./userFields";

export interface IBackofficeUser extends IUser {
  username: string;
  accessLevel: string;
  readOnly: boolean;
}

const BackofficeUserSchema: Schema = new Schema<IBackofficeUser>({
  ...UserSchema.obj,
  password: { type: String, required: false }, 
  username: { type: String, required: true, unique: true },
  accessLevel: { type: String, required: true },
  readOnly: { type: Boolean, default: false },
});

const BackofficeUser =
  mongoose.models.BackofficeUser ||
  mongoose.model<IBackofficeUser>("BackofficeUser", BackofficeUserSchema);

export default BackofficeUser;
