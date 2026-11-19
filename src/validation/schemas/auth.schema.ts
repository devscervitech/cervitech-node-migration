import Joi from 'joi';
import { MOBILE_CHANNEL } from '../../enums/mobileChannel';

export const passwordPolicySchema = Joi.string()
  .replace(/\s/g, '')
  .description('All whitespace is removed before password validation and hashing.')
  .required()
  .min(8)
  .max(30)
  .pattern(/[A-Z]/, { name: 'uppercase character' })
  .pattern(/[a-z]/, { name: 'lowercase character' })
  .pattern(/[0-9]/, { name: 'number' })
  .pattern(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, { name: 'special-character' })
  .messages({
    'string.empty': 'Password cannot be empty',
    'any.required': 'Password is required',
    'string.min': 'Password must have a minimum of 8 characters',
    'string.max': 'Password must have a maximum of 30 characters',
    'string.pattern.name': 'Password must include at least one {#name}',
  });

export const signupSchema = Joi.object({
  email: Joi.string().trim().lowercase().email().required().messages({
    'string.empty': 'Email is required',
    'string.email': 'Email must be a valid email address',
    'any.required': 'Email is required',
  }),

  password: passwordPolicySchema,

  firstName: Joi.string().required().messages({
    'string.empty': 'First name cannot be empty',
    'any.required': 'First name is required',
  }),

  confirmPassword: Joi.string()
    .replace(/\s/g, '')
    .required()
    .valid(Joi.ref('password'))
    .messages({
      'string.empty': 'Confirm password cannot be empty',
      'any.required': 'Confirm password is required',
      'any.only':"Confirm password does not match password"
    }),



  lastName: Joi.string().required().messages({
    'string.empty': 'Last name cannot be empty',
    'any.required': 'Last name is required',
  }),

  username: Joi.string()
    .trim()
    .lowercase()
    .required()
    .min(3)
    .max(50)
    .pattern(/^[a-zA-Z0-9]+$/, { name: 'alphanumeric characters' })
    .messages({
      'string.empty': 'Username cannot be empty',
      'any.required': 'Username is required',
      'string.pattern.name': 'Username must only contain {#name}',
      'string.min': 'Username must be a minimum of 3 characters',
    }),

  mobileChannel: Joi.number()
    .required()
    .valid(...Object.values(MOBILE_CHANNEL))
    .messages({
      'number.base': 'Mobile channel must be a valid number',
      'any.required': 'Mobile channel is required',
      'any.only': 'Invalid mobile channel provided',
    }),

  fcmToken: Joi.string().optional().allow(null, ''),
  pictureUrl: Joi.string().uri().optional().allow(null, ''),
})
.prefs({ abortEarly: false }); 




export const loginSchema = Joi.object({
  emailOrUsername: Joi.string().trim().lowercase().required().messages({
    'any.required': 'Email or username is required',
    'string.empty': 'Email or username cannot be empty',
  }),

  password: Joi.string()
    .replace(/\s/g, '')
    .description('All whitespace is removed before password verification.')
    .required()
    .messages({
    'string.empty': 'Password cannot be empty',
    'any.required': 'Password is required',
  }),

   mobileChannel: Joi.number()
    .required()
    .valid(...Object.values(MOBILE_CHANNEL))
    .messages({
      'number.base': 'Mobile channel must be a valid number',
      'any.required': 'Mobile channel is required',
      'any.only': 'Invalid mobile channel provided',
    }),
})
.prefs({ abortEarly: false }); 

const normalizedEmailSchema = Joi.string()
  .trim()
  .lowercase()
  .email()
  .max(254)
  .required()
  .messages({
    'string.base': 'Email must be a string',
    'string.email': 'Email must be a valid email address',
    'string.max': 'Email cannot exceed 254 characters',
    'any.required': 'Email is required',
  });

export const appUserChangePasswordSchema = Joi.object({
  formerPassword: Joi.string().min(1).max(4096).required().messages({
    'string.base': 'Current password must be a string',
    'string.empty': 'Current password is required',
    'string.max': 'Current password is too long',
    'any.required': 'Current password is required',
  }),
  newPassword: passwordPolicySchema,
}).prefs({ abortEarly: false, allowUnknown: false });

export const appUserResetPasswordSchema = Joi.object({
  token: Joi.string().trim().min(1).max(4096).required(),
  newPassword: passwordPolicySchema,
}).prefs({ abortEarly: false, allowUnknown: false });

export const appUserResetRequestSchema = Joi.object({
  email: normalizedEmailSchema,
}).prefs({ abortEarly: false, allowUnknown: false });

export const appUserVerifyResetOtpSchema = Joi.object({
  email: normalizedEmailSchema,
  otp: Joi.string().pattern(/^\d{6}$/).required().messages({
    'string.base': 'OTP must be a string',
    'string.pattern.base': 'OTP must be a 6-digit code',
    'any.required': 'OTP is required',
  }),
}).prefs({ abortEarly: false, allowUnknown: false });

export const usernameExistsQuerySchema = Joi.object({
  username: Joi.string()
    .trim()
    .lowercase()
    .min(3)
    .max(50)
    .pattern(/^[a-zA-Z0-9]+$/)
    .required()
    .messages({
      'string.base': 'Username must be a string',
      'string.empty': 'Username is required',
      'string.min': 'Username must contain at least 3 characters',
      'string.max': 'Username cannot exceed 50 characters',
      'string.pattern.base': 'Username must contain only letters and numbers',
      'any.required': 'Username is required',
    }),
}).prefs({ abortEarly: false, allowUnknown: false });

export const emailValidationQuerySchema = Joi.object({
  email: Joi.string().trim().max(254).required().messages({
    'string.base': 'Email must be a string',
    'string.max': 'Email cannot exceed 254 characters',
    'any.required': 'Email is required',
  }),
}).prefs({ abortEarly: false, allowUnknown: false });


export const logoutSchema = Joi.object({
    userId: Joi.string().required().messages({
        'any.required': 'User id is required',
        'string.empty': 'User id cannot be empty'
    }),

    token: Joi.string().required().messages({
        'any.required': 'Token is required',
        'string.empty': 'Token cannot be empty'
    })
})
.prefs({ abortEarly: false }); 


