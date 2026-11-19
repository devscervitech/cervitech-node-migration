import Joi from 'joi';
import { signupSchema } from './auth.schema';
import { BACKOFFICE_ACCESS_LEVELS } from '../../enums/backofficeAccessLevel';

/**
 * Back-office request schemas.
 *
 * Password policy: reused from the active app-user signup rule via
 * `signupSchema.extract('password')`, so there is a single definition. It is
 * applied to back-office password creation and every new-password field. The
 * current password is validated separately and is not held to the policy, so
 * accounts with older passwords can still change them.
 *
 * Every schema rejects unknown keys, so protected fields (password on profile
 * updates, _id, accessLevel/readOnly outside the dedicated access route) and
 * MongoDB operators such as `$set` are refused with a 400 instead of reaching
 * a query. Custom messages avoid echoing submitted values.
 */
const passwordPolicy = (signupSchema.extract('password') as Joi.StringSchema)
  .replace(/\s/g, '')
  .description('All whitespace is removed before password validation and hashing.');

const name = (label: string) =>
  Joi.string()
    .trim()
    .min(1)
    .max(100)
    .messages({
      'string.base': `${label} must be a string`,
      'string.empty': `${label} cannot be empty`,
      'string.min': `${label} cannot be empty`,
      'string.max': `${label} must have a maximum of 100 characters`,
      'any.required': `${label} is required`,
    });

const email = Joi.string()
  .trim()
  .email()
  .max(254)
  .messages({
    'string.base': 'Email must be a string',
    'string.empty': 'Email cannot be empty',
    'string.email': 'Email must be a valid email address',
    'string.max': 'Email must have a maximum of 254 characters',
    'any.required': 'Email is required',
  });

const telephone = Joi.string()
  .trim()
  .max(32)
  .allow('')
  .messages({
    'string.base': 'Telephone must be a string',
    'string.max': 'Telephone must have a maximum of 32 characters',
  });

const username = Joi.string()
  .trim()
  .min(3)
  .max(50)
  .pattern(/^[a-zA-Z0-9]+$/, { name: 'alphanumeric characters' })
  .messages({
    'string.base': 'Username must be a string',
    'string.empty': 'Username cannot be empty',
    'string.min': 'Username must be a minimum of 3 characters',
    'string.max': 'Username must have a maximum of 50 characters',
    'string.pattern.name': 'Username must only contain {#name}',
    'any.required': 'Username is required',
  });

// Access levels are authorization roles, not free-form labels.
const accessLevel = Joi.string()
  .trim()
  .uppercase()
  .valid(...BACKOFFICE_ACCESS_LEVELS)
  .messages({
    'string.base': 'Access level must be a string',
    'any.only': 'Access level must be ADMIN or OPERATOR',
    'any.required': 'Access level is required',
  });

// Strict: only real booleans, so "false"/"0" strings are not coerced.
const readOnly = Joi.boolean()
  .strict()
  .messages({ 'boolean.base': 'readOnly must be a boolean' });

/** A required non-empty string with no policy (current password, token, login fields). */
const requiredString = (label: string) =>
  Joi.string()
    .min(1)
    .max(4096)
    .required()
    .messages({
      'string.base': `${label} must be a string`,
      'string.empty': `${label} is required`,
      'string.min': `${label} is required`,
      'string.max': `${label} is too long`,
      'any.required': `${label} is required`,
    });

/** Password input removes whitespace everywhere before it is checked. */
const requiredPassword = (label: string) =>
  Joi.string()
    .replace(/\s/g, '')
    .description('All whitespace is removed before password verification.')
    .min(1)
    .max(4096)
    .required()
    .messages({
      'string.base': `${label} must be a string`,
      'string.empty': `${label} is required`,
      'string.min': `${label} is required`,
      'string.max': `${label} is too long`,
      'any.required': `${label} is required`,
    });

const objectMessages = {
  'object.base': 'Request body must be a JSON object',
  'object.unknown': 'Field {#label} is not allowed',
  'object.min': 'At least one updatable field is required',
};

/** POST /backoffice-users/signup (now admin-only). */
export const createBackofficeUserSchema = Joi.object({
  firstName: name('First name').required(),
  lastName: name('Last name').required(),
  email: email.required(),
  telephone: telephone.optional(),
  username: username.required(),
  password: passwordPolicy,
  accessLevel: accessLevel.required(),
  readOnly: readOnly.optional(),
}).messages(objectMessages);

/** PUT /backoffice-users/:id — profile fields only. */
export const updateBackofficeProfileSchema = Joi.object({
  firstName: name('First name'),
  lastName: name('Last name'),
  email,
  telephone,
})
  .min(1)
  .messages(objectMessages);

/** PUT /backoffice-users/:id/access — administrator-controlled role and read-only flag. */
export const updateBackofficeAccessSchema = Joi.object({
  accessLevel,
  readOnly,
})
  .min(1)
  .messages(objectMessages);

/** POST /backoffice-users/login — strings only, which blocks operator objects. */
export const backofficeLoginSchema = Joi.object({
  username: requiredString('Username'),
  password: requiredPassword('Password'),
}).messages(objectMessages);

/** POST /backoffice-users/change-password */
export const backofficeChangePasswordSchema = Joi.object({
  currentPassword: requiredPassword('Current password'),
  newPassword: passwordPolicy,
}).messages(objectMessages);

/** POST /backoffice-users/forgot-password */
export const backofficeForgotPasswordSchema = Joi.object({
  email: email.required(),
}).messages(objectMessages);

/** OTPs remain strings so leading zeroes are preserved and numeric input is refused. */
const OTP_MESSAGE = 'OTP must be a 6-digit code';
export const backofficeVerifyResetOtpSchema = Joi.object({
  email: email.required(),
  otp: Joi.string()
    .strict()
    .trim()
    .pattern(/^\d{6}$/)
    .required()
    .messages({
      'string.base': OTP_MESSAGE,
      'string.empty': OTP_MESSAGE,
      'string.pattern.base': OTP_MESSAGE,
      'any.required': 'OTP is required',
    }),
}).messages(objectMessages);

/** POST /backoffice-users/reset-password */
export const backofficeResetPasswordSchema = Joi.object({
  token: requiredString('Token'),
  newPassword: passwordPolicy,
}).messages(objectMessages);
