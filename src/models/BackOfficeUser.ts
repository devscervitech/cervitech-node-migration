import mongoose, { Schema, Document } from 'mongoose';
import { IUser, UserSchema } from './User';

export interface IBackOfficeUser extends IUser {
  username: string;
  verified: boolean;
  accessLevel: string;
  readOnly: string;
}

const BackOfficeUserSchema = new Schema<IBackOfficeUser>({
  username: { type: String, required: true, unique: true },
  verified: { type: Boolean, default: false },
  accessLevel: { type: String, required: true },
  readOnly: { type: String, required: true },
});

BackOfficeUserSchema.add({...UserSchema.obj});

const BackOfficeUser = mongoose.model<IBackOfficeUser>('BackOfficeUser', BackOfficeUserSchema);
export default BackOfficeUser;
