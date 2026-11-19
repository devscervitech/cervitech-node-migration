import mongoose, { Schema, Document } from 'mongoose';
import { IUser } from './User';
import { MOBILE_CHANNEL } from '../enums/mobileChannel';
import { INeckAngleRecord, EmbeddedNeckAngleRecordSchema } from './NeckAngleRecord';
import { IGoal, EmbeddedGoalSchema } from './Goal';

export interface IAppUser extends IUser {
  fcmToken: string;
  username: string;
  lastLoginDateTime: Date;
  allowPushNotifications: boolean;
  hasPaid: boolean;
  isGoalOn: boolean;
  responseRate: number;
  /** @deprecated B12 — not loaded by default and no longer written. */
  neckAngleRecords: INeckAngleRecord[];
  neckAngleRecordCounter?: number;
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

  // DEPRECATED (B12): readings live in the NeckAngleRecord collection only.
  // Batch posts used to also $push every reading here, growing the user
  // document toward MongoDB's 16 MB limit. Nothing writes to it any more;
  // scripts/migrate-neck-angle-storage.ts copies anything embedded-only into
  // the collection and then unsets it. `select: false` keeps it out of every
  // user load in the meantime.
  neckAngleRecords: { type: [EmbeddedNeckAngleRecordSchema], select: false },
  // B12: last counter handed out to this user's readings. Reserved in blocks
  // with an atomic $inc so concurrent batches never share a counter.
  neckAngleRecordCounter: { type: Number },

  goals: [EmbeddedGoalSchema],

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

// B12: compound indexes support the bounded reminder cursors and the monthly
// inactivity scan. These indexes include the query's cooldown/range fields so
// the jobs do not repeatedly collection-scan the full user table.
AppUserSchema.index({ deleted: 1, lastLoginDateTime: 1 });
AppUserSchema.index({ deleted: 1, allowPushNotifications: 1, isGoalOn: 1, dateRegistered: 1, lastGoalReminderSentAt: 1, fcmToken: 1 });
AppUserSchema.index({ deleted: 1, allowPushNotifications: 1, dateRegistered: 1, lastCheckInReminderSentAt: 1, fcmToken: 1 });
AppUserSchema.index({ deleted: 1, allowPushNotifications: 1, isGoalOn: 1, lastGoalReminderSentAt: 1, fcmToken: 1 });
AppUserSchema.index({ deleted: 1, allowPushNotifications: 1, lastBadPostureAlertSentAt: 1, fcmToken: 1 });

const AppUser = mongoose.models.AppUser || mongoose.model<IAppUser>('AppUser', AppUserSchema);

export default AppUser;
