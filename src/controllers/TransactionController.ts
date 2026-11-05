import { Request, Response } from 'express';
import { TransactionService } from "../services/TransactionService";
import { TransactionViewModel } from '../dtos/transaction.DTO';

export class TransactionController {
  static async createTransactionRecord(req: Request, res: Response): Promise<void> {
    const transactionVM: TransactionViewModel = req.body;

    if (!transactionVM) {
      res.status(400).json({ error: "Transaction data is required." });
      return;
    }

    try {
      const result = await TransactionService.transactionRecords(transactionVM);

      if (!result) {
        res.status(400).json({ error: "Failed to create transaction record." });
        return;
      }

      res.status(201).json(result);
    } catch (error) {
      console.error("Error creating transaction record:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  static async getAllTransactionRecords(req: Request, res: Response): Promise<void> {
    try {
      const result = await TransactionService.getAllTransactionRecords();

      if (!result) {
        res.status(404).json({ error: "No transaction records found." });
        return;
      }

      res.status(200).json(result);
    } catch (error) {
      console.error("Error fetching all transaction records:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  static async getTransactionRecordById(req: Request, res: Response): Promise<void> {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({ error: "Transaction ID is required." });
      return;
    }

    try {
      const result = await TransactionService.getTransactionRecordById(id);

      if (!result) {
        res.status(404).json({ error: "Transaction record not found." });
        return;
      }

      res.status(200).json(result);
    } catch (error) {
      console.error("Error fetching transaction record by ID:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  static async getTransactionRecordsByUserId(req: Request, res: Response): Promise<void> {
    const { userId } = req.params;

    if (!userId) {
      res.status(400).json({ error: "User ID is required." });
      return;
    }

    try {
      const result = await TransactionService.getTransactionRecordsByUserId(userId);

      if (!result) {
        res.status(404).json({ error: "No transaction records found for this user." });
        return;
      }

      res.status(200).json(result);
    } catch (error) {
      console.error("Error fetching transaction records by user ID:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

}