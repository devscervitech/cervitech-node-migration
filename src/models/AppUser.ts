import mongoose, { Schema, Document } from 'mongoose';
import { IUser } from './User';
import { MOBILE_CHANNEL } from '../enums/mobileChannel';
import { NeckAngleRecordSchema, INeckAngleRecord } from './NeckAngleRecord';
import { GoalSchema, IGoal } from './Goal';

export interface IAppUser extends IUser {
  email: string;
  firstName: string;
  lastName: string;
  pictureUrl: string;
  fcmToken: string;
  username: string;
  hash: string;
  salt: string;
  lastLoginDateTime: Date;
  allowPushNotifications: boolean;
  hasPaid: boolean;
  isGoalOn: boolean;
  responseRate: number;
  neckAngleRecords: INeckAngleRecord[];
  goals: IGoal[];
  mobileChannel: MOBILE_CHANNEL;
  prompt: number;
  notificationCount?: number;
  currentTargetedAverageNeckAngle: number;
  dateRegistered: Date;
  notificationResponse?: number;
}

const AppUserSchema: Schema = new Schema<IAppUser>({
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

const AppUser =
  mongoose.models.AppUser || mongoose.model('AppUser', AppUserSchema);

export default AppUser;
