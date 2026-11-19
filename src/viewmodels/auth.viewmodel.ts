// src/viewmodels/auth.viewmodel.ts

import { inflateSync } from 'node:zlib';

export interface BaseServiceResponse {
  success: boolean;
  message: string;
}

export interface SignupRequest {
  email: string;
  password: string;
  confirmPassword: string;
  lastName: string;
  firstName: string;
  username: string;
  mobileChannel: number;
  fcmToken?: string;
  pictureUrl?: string;
}

//added success to the response to handle when the its successful or not
export interface SignupResponse extends BaseServiceResponse {
  data?: object;
}

export interface PasswordResetTokenRequest {
  email: string;
}

export interface PasswordResetRequest {
  token: string;
  newPassword: string;
}

export interface PasswordResetResponse extends BaseServiceResponse {}

export interface SendPasswordTokenResponse extends BaseServiceResponse {
  otp?: string;
}

export interface VerifyOtpRequest {
  email: string;
  otp: string;
}

export interface VerifyOtpResponse extends BaseServiceResponse {
  token?: string;
}
