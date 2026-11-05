import { User } from '../dtos/user.entity';

export interface LoginResponse {
  id: string;
  username: string;
  email: string;
  token: string;
}

export interface MininmalUser {
  _id: string;
  email: string;
}