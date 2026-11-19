import mongoose, { Schema, Document } from 'mongoose';
import { TRANSACTION_STATUS } from '../enums/transaction'; // Assume you have a status enum defined somewhere

export interface ITransactionRecord extends Document {
  appUserId: string;
  paymentRef: string;
  amount: number;
  status: number;
  transDate: Date;
  description?: string;
  entitlementGranted: boolean;
  // #08/#09: set when this record's status came from a verified Play
  // purchase token rather than the client. Only these records are eligible
  // for the subscription-sync job's periodic re-verification.
  purchaseToken?: string;
  packageName?: string;
  subscriptionId?: string;
  createdOn: Date;
  updatedOn?: Date;
  deletedOn?: Date;
}

const TransactionRecordSchema = new Schema<ITransactionRecord>({
  appUserId: { type: String, required: true },
  paymentRef: { type: String, required: true, unique: true },
  amount: { type: Number, required: true },
  status: { type: Number, enum: Object.values(TRANSACTION_STATUS), required: true },
  transDate: { type: Date, required: true, default: Date.now },
  description: { type: String },
  // Set once this record has granted hasPaid, so it can't re-grant on replay
  // (e.g. a future status re-check via #08/#09 re-processing the same record).
  entitlementGranted: { type: Boolean, default: false },
  purchaseToken: { type: String },
  packageName: { type: String },
  subscriptionId: { type: String },
  createdOn: { type: Date, default: Date.now },
  updatedOn: { type: Date, default: Date.now },
  deletedOn: { type: Date },
},
{ timestamps: true });

const TransactionRecord = mongoose.model<ITransactionRecord>('TransactionRecord', TransactionRecordSchema);
export default TransactionRecord;
