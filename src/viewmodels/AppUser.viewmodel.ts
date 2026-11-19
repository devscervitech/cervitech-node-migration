import { IAppUser } from '../models/AppUser';
import { MOBILE_CHANNEL } from '../enums/mobileChannel';

export interface AppUserViewModel {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  hasPaid: boolean;
  pictureUrl: string;
  fcmToken: string;
  isGoalOn: boolean;
  allowPushNotifications: boolean;
  responseRate: number;
  dateRegistered: string;
  lastLoginDateTime: Date;
  mobileChannel: MOBILE_CHANNEL;
  prompt: number;
  notificationCount?: number;
  deleted: boolean;
}

export function toAppUserViewModel(user: IAppUser): AppUserViewModel {
  return {
    id: String(user._id),
    username: user.username,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    hasPaid: user.hasPaid,
    pictureUrl: user.pictureUrl,
    fcmToken: user.fcmToken,
    isGoalOn: user.isGoalOn,
    allowPushNotifications: user.allowPushNotifications,
    responseRate: user.responseRate,
    dateRegistered: user.dateRegistered.toISOString(),
    lastLoginDateTime: user.lastLoginDateTime,
    mobileChannel: user.mobileChannel,
    prompt: user.prompt,
    notificationCount: user.notificationCount,
    deleted: user.deleted,
  };
}
