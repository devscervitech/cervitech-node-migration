import { neckAngleRecordViewModel } from './neckAngleRecord.viewmodels.js';
import { MOBILE_CHANNEL } from '../enums/mobileChannel.js';

export interface appUserViewModel {
  id: number;
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
  neckAngleRecords: neckAngleRecordViewModel[];
  mobileChannel: MOBILE_CHANNEL;
  notificationCount?: number;
  notificationResponse?: number;
}
