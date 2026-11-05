import mongoose, { Schema, Document } from 'mongoose';
import { TRANSACTION_STATUS } from '../enums/transaction'; // Assume you have a status enum defined somewhere

export interface ITransactionRecord extends Document {
  appUserId: string;
  paymentRef: string;
  amount: number;
  status: TRANSACTION_STATUS;
  transDate: Date;
  description?: string;
  createdOn: Date;
  updatedOn?: Date;
  deletedOn?: Date;
}

const TransactionRecordSchema = new Schema<ITransactionRecord>({
  appUserId: { type: String, required: true },
  paymentRef: { type: String, required: true },
  amount: { type: Number, required: true },
  status: { type: Number, enum: Object.values(TRANSACTION_STATUS), required: true },
  transDate: { type: Date, required: true },
  description: { type: String },
  createdOn: { type: Date, default: Date.now },
  updatedOn: { type: Date },
  deletedOn: { type: Date },
},
{ timestamps: true });

const TransactionRecord = mongoose.model<ITransactionRecord>('TransactionRecord', TransactionRecordSchema);
export default TransactionRecord;
