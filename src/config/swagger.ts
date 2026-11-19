// src/config/swagger.ts
import swaggerJSDoc from 'swagger-jsdoc';
import j2s from 'joi-to-swagger';
import {
  signupSchema,
  loginSchema,
  logoutSchema,
  appUserChangePasswordSchema,
  appUserResetPasswordSchema,
  appUserResetRequestSchema,
  appUserVerifyResetOtpSchema,
} from '../validation/schemas/auth.schema';
import { transactionSchema } from '../validation/schemas/transaction.schema';
import {
  createBackofficeUserSchema,
  updateBackofficeProfileSchema,
  updateBackofficeAccessSchema,
  backofficeLoginSchema,
  backofficeChangePasswordSchema,
  backofficeForgotPasswordSchema,
  backofficeVerifyResetOtpSchema,
  backofficeResetPasswordSchema,
} from '../validation/schemas/backOfficeUser.schema';

// Request-body schemas are derived from the same Joi schemas the controllers
// validate against at runtime, so the docs can't drift from actual behavior.
function fromJoi(schema: Parameters<typeof j2s>[0]) {
  return j2s(schema).swagger;
}

const definition: swaggerJSDoc.OAS3Definition = {
  openapi: '3.0.3',
  info: {
    title: 'CerviTech API',
    version: '1.0.0',
    description:
      'Interactive reference for the CerviTech backend. Endpoints are documented via JSDoc comments in each route file.',
  },
  servers: [{ url: '/api/v1', description: 'Versioned API root' }],
  security: [{ bearerAuth: [] }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      SignupRequest: fromJoi(signupSchema),
      LoginRequest: fromJoi(loginSchema),
      LogoutRequest: fromJoi(logoutSchema),
      AppUserChangePasswordRequest: fromJoi(appUserChangePasswordSchema),
      AppUserResetPasswordRequest: fromJoi(appUserResetPasswordSchema),
      AppUserResetRequest: fromJoi(appUserResetRequestSchema),
      AppUserVerifyResetOtpRequest: fromJoi(appUserVerifyResetOtpSchema),
      TransactionRequest: fromJoi(transactionSchema),
      CreateBackofficeUserRequest: fromJoi(createBackofficeUserSchema),
      UpdateBackofficeProfileRequest: fromJoi(updateBackofficeProfileSchema),
      UpdateBackofficeAccessRequest: fromJoi(updateBackofficeAccessSchema),
      BackofficeLoginRequest: fromJoi(backofficeLoginSchema),
      BackofficeChangePasswordRequest: fromJoi(backofficeChangePasswordSchema),
      BackofficeForgotPasswordRequest: fromJoi(backofficeForgotPasswordSchema),
      BackofficeVerifyResetOtpRequest: fromJoi(backofficeVerifyResetOtpSchema),
      BackofficeResetPasswordRequest: fromJoi(backofficeResetPasswordSchema),
      ApiSuccessResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string', example: 'Successful' },
          data: {},
        },
      },
      ApiErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string', example: 'Something went wrong' },
          error: { type: 'string' },
        },
      },
    },
  },
};

const options: swaggerJSDoc.Options = {
  definition,
  // Comments survive `tsc` (removeComments is off), so scanning the .ts
  // sources works whether the server runs via tsx (dev) or dist/*.js (prod).
  apis: ['./src/routes/*.ts', './dist/routes/*.js'],
};

export const swaggerSpec = swaggerJSDoc(options);
