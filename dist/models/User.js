import mongoose, { Schema } from 'mongoose';
export const UserSchema = new Schema({
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
const User = mongoose.models.User || mongoose.model('User', UserSchema);
export default User;
