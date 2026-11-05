import mongoose, { Schema } from 'mongoose';
const PasswordResetTokenSchema = new Schema({
    email: { type: String, required: true },
    token: { type: String, required: true },
    creationTime: { type: Date, default: Date.now },
    expirationTime: { type: Date, required: true },
});
const PasswordResetToken = mongoose.model('PasswordResetToken', PasswordResetTokenSchema);
export default PasswordResetToken;
