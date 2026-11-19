// src/dtos/backOfficeUserModel.ts
export interface backOfficeUserModel {
  firstName: string;
  lastName: string;
  email: string;
  telephone?: string;
  username: string;
  password: string;
  accessLevel: string;
  readOnly?: boolean;
}


