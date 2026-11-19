import { LoginRequest, LogoutRequest } from '../types/auth.types';
import { SignupRequest } from '../viewmodels/auth.viewmodel';
import { signupSchema, loginSchema, logoutSchema } from './schemas/auth.schema';
import Joi from 'joi';

export class AuthValidation {
  private static validate<T>(schema: Joi.ObjectSchema, input: T): string | null {
    const { error } = schema.validate(input, {
      abortEarly: false,
      allowUnknown: false,
    });

    if (error) {
      return error.message
    }

    return null;
  }

  static signupValidation(input: SignupRequest): string | null {
    return this.validate(signupSchema, input);
  }

  static loginValidation(input: LoginRequest): string | null {
    return this.validate(loginSchema, input);
  }

  static logoutValidation(input: LogoutRequest): string | null {
    return this.validate(logoutSchema, input);
  }
}
