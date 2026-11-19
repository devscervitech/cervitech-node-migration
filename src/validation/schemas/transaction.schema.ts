import Joi from 'joi';
import { TRANSACTION_STATUS } from '../../enums/transaction';

export const transactionSchema = Joi.object({
  paymentRef: Joi.string().trim(),

  amount: Joi.number().positive().required().messages({
    'number.base': 'Amount must be a valid number',
    'any.required': 'Amount is required',
  }),

  status: Joi.number().valid(...Object.values(TRANSACTION_STATUS)).messages({
    'number.base': 'Status must be a valid number',
    'any.only': 'Invalid transaction status provided',
  }),

  transDate: Joi.alternatives()
    .try(Joi.date(), Joi.string())
    .required()
    .messages({
      'any.required': 'Transaction date is required',
      'alternatives.match': 'Transaction date must be a valid date',
    }),

  description: Joi.string().optional().allow(null, ''),

  // Client status never authorizes access; every submission requires verification.
  purchaseToken: Joi.string().trim().required(),
  packageName: Joi.string().trim().required(),
  subscriptionId: Joi.string().trim().required(),
}).prefs({ abortEarly: false });
