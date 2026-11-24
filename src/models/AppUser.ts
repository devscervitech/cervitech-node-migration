import mongoose, { Schema, Document } from 'mongoose';
import { IUser } from './userFields';
import { MOBILE_CHANNEL } from '../enums/mobileChannel';
import { INeckAngleRecord, NeckAngleRecordSchema } from './NeckAngleRecord';
import { IGoal, GoalSchema } from './Goal';

export interface IAppUser extends IUser {
  fcmToken: string;
  username: string;
  lastLoginDateTime: Date;
  allowPushNotifications: boolean;
  hasPaid: boolean;
  isGoalOn: boolean;
  responseRate: number;
  neckAngleRecords: INeckAngleRecord[];
  goals: IGoal[];
  mobileChannel: MOBILE_CHANNEL; // Now uses number enum
  prompt: number;
  notificationCount?: number;
  currentTargetedAverageNeckAngle: number;
  notificationResponse?: number;
  deleted: boolean;
  dateRegistered: Date; // Keep as Date type
  lastGoalReminderSentAt?: Date;
  lastCheckInReminderSentAt?: Date;
  lastBadPostureAlertSentAt?: Date;
}

const AppUserSchema: Schema = new Schema<IAppUser>({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  pictureUrl: { type: String },
  fcmToken: { type: String },
  username: { type: String, required: true, unique: true },
  lastLoginDateTime: { type: Date, default: Date.now },
  allowPushNotifications: { type: Boolean, default: true },
  hasPaid: { type: Boolean, default: false },
  isGoalOn: { type: Boolean, default: false },
  responseRate: { type: Number, default: 0 },
  notificationResponse: { type: Number },
  currentTargetedAverageNeckAngle: { type: Number, default: 0 }, 
  dateRegistered: { type: Date, default: Date.now }, 

  neckAngleRecords: [NeckAngleRecordSchema],

  goals: [GoalSchema],

  mobileChannel: {
    type: Number, 
    enum: Object.values(MOBILE_CHANNEL).filter(val => typeof val === 'number'), 
    default: MOBILE_CHANNEL.WEB,
  },
  prompt: { type: Number, default: 5, min: 1 },
  notificationCount: { type: Number },
  deleted: { type: Boolean, default: false },
  lastGoalReminderSentAt: { type: Date },
  lastCheckInReminderSentAt: { type: Date },
  lastBadPostureAlertSentAt: { type: Date },
}, { timestamps: true });

const AppUser = mongoose.models.AppUser || mongoose.model<IAppUser>('AppUser', AppUserSchema);

export default AppUser;