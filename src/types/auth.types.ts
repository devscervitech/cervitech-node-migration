import { MOBILE_CHANNEL } from '../enums/mobileChannel';
import { User } from './user.types';
import { BaseServiceResponse } from '../viewmodels/auth.viewmodel';

/* export interface LoginResponse {
  id: string;
  username: string;
  email: string;
  token: string;
} */




export interface MininmalUser {
  _id: string;
  email: string;
}

export interface LoginRequest {
  emailOrUsername: string;
  password: string;
  mobileChannel: MOBILE_CHANNEL; // Use the enum type
}

export interface LoginResponse {
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
  mobileChannel: MOBILE_CHANNEL; // Use the enum type
  currentTargetedAverageNeckAngle: number;
  dateRegistered: string; // Convert to string in response
  responseRate: number;
  lastLoginDateTime: Date;
  prompt: number; // Keep as number
  notificationCount: number;
  token: string; 
  deleted: boolean;
}

export interface LoginResponseResult extends BaseServiceResponse{
  data?: LoginResponse
}


export interface LoginViewModel {
  emailOrUsername: string;
  password: string;
  mobileChannel: MOBILE_CHANNEL; // Use the enum type
}

export interface LogoutRequest{
  userId: string,
  token: string
}

export interface LogoutResponse extends BaseServiceResponse{}