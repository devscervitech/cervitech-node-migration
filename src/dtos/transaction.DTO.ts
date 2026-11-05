import { MobileChannel } from "../viewmodels/AppUser";

export interface TransactionViewModel {
  id?: string;
  appUserId: string;
  paymentRef: string;
  amount: number;
  status: number;
  transDate: Date;
  description?: string;
}

export interface AppUserViewModel {
  id: string;
  username: string;
  email: string;
  FCMToken: string;
  hasPaid: boolean;
  firstName?: string;
  lastName?: string;
  pictureUrl?: string;
  salt: string;
  hash: string;
  isGoalOn: boolean;
  allowPushNotifications: boolean;
  mobileChannel: MobileChannel;
  dateRegistered?: string;
  responseRate: number;
  lastLoginDateTime?: Date;
};
