import mongoose, { Schema } from 'mongoose';
import { MOBILE_CHANNEL } from '../enums/mobileChannel';
import { NeckAngleRecordSchema } from './NeckAngleRecord';
import { GoalSchema } from './goal';
const AppUserSchema = new Schema({
    fcmToken: { type: String },
    username: { type: String, required: true, unique: true },
    lastLoginDateTime: { type: Date, default: Date.now },
    allowPushNotifications: { type: Boolean, default: true },
    hasPaid: { type: Boolean, default: false },
    isGoalOn: { type: Boolean, default: false },
    responseRate: { type: Number, default: 0 },
    notificationResponse: { type: Number, required: false },
    neckAngleRecords: {
        type: [NeckAngleRecordSchema],
        default: [],
    },
    goals: {
        type: [GoalSchema],
        default: [],
    },
    mobileChannel: {
        type: String,
        enum: Object.values(MOBILE_CHANNEL),
        default: MOBILE_CHANNEL.OTHER,
    },
    prompt: { type: Number, required: false },
    notificationCount: { type: Number, required: false },
});
const AppUser = mongoose.model('AppUser', AppUserSchema);
export default AppUser;
