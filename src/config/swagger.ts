// src/config/swagger.ts
import swaggerJSDoc from 'swagger-jsdoc';
import j2s from 'joi-to-swagger';
import { signupSchema, loginSchema, logoutSchema } from '../validation/schemas/auth.schema';
import { transactionSchema } from '../validation/schemas/transaction.schema';

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
      TransactionRequest: fromJoi(transactionSchema),
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
