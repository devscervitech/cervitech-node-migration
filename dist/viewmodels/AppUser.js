import mongoose, { Schema } from "mongoose";
export var MobileChannel;
(function (MobileChannel) {
    MobileChannel["ANDROID"] = "ANDROID";
    MobileChannel["IOS"] = "IOS";
    MobileChannel["WEB"] = "WEB";
})(MobileChannel || (MobileChannel = {}));
const AppUserSchema = new Schema({
    username: { type: String, required: true },
    email: { type: String, required: true },
    firstName: { type: String },
    lastName: { type: String },
    pictureUrl: { type: String },
    fcmToken: { type: String },
    prompt: { type: Number },
    hash: { type: String },
    salt: { type: String },
    currentTargetedAverageNeckAngle: { type: Number, default: 0 },
    isGoalOn: { type: Boolean, default: false },
    hasPaid: { type: Boolean, default: false },
    allowPushNotifications: { type: Boolean, default: true },
    responseRate: { type: Number, default: 0 },
    dateRegistered: { type: String },
    lastLoginDateTime: { type: Date },
    neckAngleRecords: { type: [Object], default: [] }, // Ideally replace 'Object' with a proper sub-schema
    mobileChannel: { type: String, enum: Object.values(MobileChannel), default: MobileChannel.WEB },
    notificationCount: { type: Number },
    notificationResponse: { type: Number }
}, { timestamps: true });
export default mongoose.model("AppUser", AppUserSchema);
