import Joi from 'joi';
import { MOBILE_CHANNEL } from '../../enums/mobileChannel';

export const signupSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.empty': 'Email is required',
    'string.email': 'Email must be a valid email address',
    'any.required': 'Email is required',
  }),

  password: Joi.string()
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
    }),

  firstName: Joi.string().required().messages({
    'string.empty': 'First name cannot be empty',
    'any.required': 'First name is required',
  }),

  confirmPassword: Joi.string()
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
    .required()
    .min(3)
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
  emailOrUsername: Joi.string().trim().required().messages({
    'any.required': 'Email or username is required',
    'string.empty': 'Email or username cannot be empty',
  }),

  password: Joi.string().required().messages({
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


