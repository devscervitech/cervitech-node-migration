import mongoose, { Schema, Document } from 'mongoose';

export interface IPasswordResetToken extends Document {
  email: string;
  token: string;
  creationTime: Date;
  expirationTime: Date;
}

const PasswordResetTokenSchema: Schema = new Schema<IPasswordResetToken>({
  email: { type: String, required: true },
  token: { type: String, required: true },
  creationTime: { type: Date, default: Date.now },
  expirationTime: { type: Date, required: true },
});

const PasswordResetToken = mongoose.model<IPasswordResetToken>('PasswordResetToken', PasswordResetTokenSchema);
export default PasswordResetToken;