import { TransactionViewModel } from '../types/transaction.types';
import { transactionSchema } from './schemas/transaction.schema';

export class TransactionValidation {
  static transactionValidation(input: TransactionViewModel): string | null {
    const { error } = transactionSchema.validate(input, {
      abortEarly: false,
      allowUnknown: false,
    });

    if (error) {
      return error.message;
    }

    return null;
  }
}
