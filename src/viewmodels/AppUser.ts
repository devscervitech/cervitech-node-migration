import mongoose, { Schema, Document } from "mongoose";


export enum MobileChannel {
  ANDROID = "ANDROID",
  IOS = "IOS",
  WEB = "WEB"

}


export interface NeckAngleRecordViewModel {
  timestamp?: Date;
  angle?: number;
}


export interface IAppUser extends Document {
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  pictureUrl: string;
  fcmToken: string;
  prompt?: number;
  hash: string;
  salt: string;
  currentTargetedAverageNeckAngle: number;
  isGoalOn: boolean;
  hasPaid: boolean;
  allowPushNotifications: boolean;
  responseRate: number;
  dateRegistered: string;
  lastLoginDateTime: Date;
  neckAngleRecords: NeckAngleRecordViewModel[];
  mobileChannel: MobileChannel;
  notificationCount?: number;
  notificationResponse?: number;
}

const AppUserSchema: Schema = new Schema({
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

export default mongoose.models.AppUser || mongoose.model<IAppUser>("AppUser", AppUserSchema);

