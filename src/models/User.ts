import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
    firstName: string;
    lastName: string;
    email: string;
    telephone: string;
    password: string;
    hash: string;
    salt: string;
    pictureUrl: string;
    dateRegistered: Date;
}

export const UserSchema: Schema = new Schema<IUser>({
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    telephone: { type: String, required: false },
    password: { type: String, required: true },
    hash: { type: String, required: true },
    salt: { type: String, required: true },
    pictureUrl: { type: String, required: false },
    dateRegistered: { type: Date, required: true, default: Date.now },
});

// Safe model creation - check if model already exists
const User = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

export default User;