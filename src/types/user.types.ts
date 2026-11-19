// src/domain/user.entity.ts
export interface User {
  _id?: string;
  name: string;
  email: string;
  password: string; // hashed
  role?: 'app_user' | 'backoffice_user';
  createdAt?: Date;
  updatedAt?: Date;
}

export interface UpdateUserRequest {
  _id?: string; 
  email?: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  telephone?: string;
}



