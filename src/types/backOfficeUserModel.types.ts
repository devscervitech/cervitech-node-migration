// src/dtos/backOfficeUserModel.ts
import type { BackofficeAccessLevel } from "../enums/backofficeAccessLevel";

export interface backOfficeUserModel {
  firstName: string;
  lastName: string;
  email: string;
  telephone?: string;
  username: string;
  password: string;
  accessLevel: BackofficeAccessLevel;
  readOnly?: boolean;
}


