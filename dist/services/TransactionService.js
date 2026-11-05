import TransactionRecord from "../models/TransactionRecord";
import { AppUserService } from "./appUserService.service";
import { CustomException } from "../helpers/CustomException";
export class TransactionService {
    // Define your service methods here
    static async paymentRefAlreadyExists(paymentRef) {
        const count = await TransactionRecord.countDocuments({
            paymentRef: paymentRef.trim().toLowerCase(),
        });
        return count > 0;
    }
    static async transactionRecords(transactionVM) {
        if (await this.paymentRefAlreadyExists(transactionVM.paymentRef)) {
            throw new CustomException("A payment with the same payment reference already exists.");
        }
        const existingRecord = await TransactionRecord.findOne({ appUserId: transactionVM.appUserId });
        if (existingRecord) {
            throw new CustomException("A record exists with this user id.");
        }
        const transaction = new TransactionRecord({
            appUserId: transactionVM.appUserId,
            paymentRef: transactionVM.paymentRef,
            amount: transactionVM.amount,
            status: transactionVM.status,
            transDate: transactionVM.transDate,
            description: transactionVM.description,
        });
        await transaction.save();
        return AppUserService.updateSubscriptionAsync(transactionVM.appUserId);
    }
    static async getAllTransactionRecords() {
        const transactionRecords = await TransactionRecord.find().lean();
        if (!transactionRecords) {
            throw new CustomException("No transaction records found.");
        }
        return transactionRecords;
    }
    static async getTransactionRecordById(id) {
        const transactionRecord = await TransactionRecord.findById(id).lean();
        if (!transactionRecord) {
            throw new CustomException("Transaction record not found.");
        }
        return transactionRecord;
    }
    static async getTransactionRecordsByUserId(appUserId) {
        const transactionRecords = await TransactionRecord.find({ appUserId }).lean();
        if (!transactionRecords) {
            throw new CustomException("No transaction records found for this user.");
        }
        return transactionRecords;
    }
}
