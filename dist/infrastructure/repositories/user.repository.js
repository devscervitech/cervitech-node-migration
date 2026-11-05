import mongoose from 'mongoose';
const userSchema = new mongoose.Schema({
    name: String,
    email: { type: String, unique: true },
    password: String,
    role: { type: String, enum: ['app_user', 'backoffice_user'], default: 'app_user' }
}, { timestamps: true });
const UserModel = mongoose.model('User', userSchema);
export const UserRepository = {
    async findByEmail(email) {
        return await UserModel.findOne({ email });
    },
    async create(user) {
        return await UserModel.create(user);
    },
    async updatePassword(userId, newPassword) {
        return await UserModel.findByIdAndUpdate(userId, { password: newPassword }, { new: true });
    }
};
