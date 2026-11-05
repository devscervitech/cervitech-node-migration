import express from "express";
import { TransactionController } from "../controllers/TransactionController";
const router = express.Router();
router.get("/transactions", TransactionController.getAllTransactionRecords);
router.get("/transactions/:id", TransactionController.getTransactionRecordById);
router.get("/transactions/user/:userId", TransactionController.getTransactionRecordsByUserId);
router.post("/transactions/", TransactionController.createTransactionRecord);
export default router;
