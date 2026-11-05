import mongoose, { Schema } from 'mongoose';
import { TRANSACTION_STATUS } from '../enums/transaction'; // Assume you have a status enum defined somewhere
const TransactionRecordSchema = new Schema({
    appUserId: { type: String, required: true },
    paymentRef: { type: String, required: true },
    amount: { type: Number, required: true },
    status: { type: Number, enum: Object.values(TRANSACTION_STATUS), required: true },
    transDate: { type: Date, required: true },
    description: { type: String },
    createdOn: { type: Date, default: Date.now },
    updatedOn: { type: Date },
    deletedOn: { type: Date },
}, { timestamps: true });
const TransactionRecord = mongoose.model('TransactionRecord', TransactionRecordSchema);
export default TransactionRecord;
