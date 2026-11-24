import { LoginRequest, LogoutRequest } from '../types/auth.types';
import { SignupRequest } from '../viewmodels/auth.viewmodel';
import { signupSchema, loginSchema, logoutSchema } from './schemas/auth.schema';
import Joi from 'joi';

export type AuthValidationResult<T> =
  | { valid: true; value: T }
  | { valid: false; error: string };

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

  private static validateAndReturn<T>(schema: Joi.ObjectSchema, input: T): AuthValidationResult<T> {
    const { error, value } = schema.validate(input, {
      abortEarly: false,
      allowUnknown: false,
    });

    if (error) return { valid: false, error: error.message };
    return { valid: true, value: value as T };
  }

  static signupValidation(input: SignupRequest): AuthValidationResult<SignupRequest> {
    return this.validateAndReturn(signupSchema, input);
  }

  static loginValidation(input: LoginRequest): AuthValidationResult<LoginRequest> {
    return this.validateAndReturn(loginSchema, input);
  }

  static logoutValidation(input: LogoutRequest): string | null {
    return this.validate(logoutSchema, input);
  }
}
