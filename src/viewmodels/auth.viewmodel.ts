// src/viewmodels/auth.viewmodel.ts
export interface SignupRequest {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export interface SignupResponse {
  message: string;
  data: object;
}

export interface passwordResetRequest{
  email: string;
}

export interface passwordResetResponse{
  token: string;
  newPassword: string;
}

