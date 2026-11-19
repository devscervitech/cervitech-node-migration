import { Request, Response } from 'express';
import { TransactionService } from '../services/transaction.service';
import { TransactionViewModel } from '../types/transaction.types';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { CustomException } from '../utils/customException';
import { TransactionError } from '../utils/transactionError';

export class TransactionController {
  static async createTransactionRecord(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const transactionVM: TransactionViewModel = req.body;

    if (!transactionVM) {
      res.status(400).json({
        error: 'Transaction data is required.',
        code: 'TRANSACTION_DATA_MISSING',
      });
      return;
    }

    try {
      const result = await TransactionService.transactionRecords(userId, transactionVM);

      if (!result) {
        res.status(400).json({ error: 'Failed to create transaction record.' });
        return;
      }

      res.status(201).json(result);
    } catch (error: any) {
      console.error('Error creating transaction record:', error);

      if (error instanceof TransactionError) {
        res.status(error.statusCode).json({
          error: error.message,
          code: error.code,
        });
        return;
      }

      if (error instanceof CustomException || error?.name === 'ValidationError') {
        res.status(400).json({ error: error.message });
        return;
      }

      res.status(500).json({
        error: 'Internal server error',
        code: 'TRANSACTION_INTERNAL_ERROR',
      });
    }
  }

  static async getAllTransactionRecords(req: Request, res: Response): Promise<void> {
    try {
      const result = await TransactionService.getAllTransactionRecords();

      if (!result) {
        res.status(404).json({ error: 'No transaction records found.' });
        return;
      }

      res.status(200).json(result);
    } catch (error) {
      console.error('Error fetching all transaction records:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async getTransactionRecordById(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;

    if (!id) {
      res.status(400).json({ error: 'Transaction ID is required.' });
      return;
    }

    try {
      const result = await TransactionService.getTransactionRecordById(userId, id);

      if (!result) {
        res.status(404).json({ error: 'Transaction record not found.' });
        return;
      }

      res.status(200).json(result);
    } catch (error) {
      console.error('Error fetching transaction record by ID:', error);
      if (error instanceof CustomException) {
        const statusCode = error.message === 'Invalid transaction ID.' ? 400 : 404;
        res.status(statusCode).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  static async getTransactionRecordsByUserId(req: AuthenticatedRequest, res: Response) {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const result = await TransactionService.getTransactionRecordsByUserId(userId);

      if (!result) {
        res.status(404).json({ error: 'No transaction records found for this user.' });
        return;
      }

      res.status(200).json(result);
    } catch (error) {
      console.error('Error fetching transaction records by user ID:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}
