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
  nextVerificationAt?: Date;
  statusChangedAt?: Date;
  updatedAt?: Date;
  packageName?: string;
  subscriptionId?: string;
  createdOn: Date;
  updatedOn?: Date;
  deletedOn?: Date;
}

const TransactionRecordSchema = new Schema<ITransactionRecord>({
  // B12: read by the per-user list endpoint and grouped on by the sync job.
  appUserId: { type: String, required: true, index: true },
  paymentRef: { type: String, required: true, unique: true },
  amount: { type: Number, required: true },
  status: { type: Number, enum: Object.values(TRANSACTION_STATUS), required: true },
  transDate: { type: Date, required: true, default: Date.now },
  description: { type: String },
  // Set once this record has granted hasPaid, so it can't re-grant on replay
  // (e.g. a future status re-check via #08/#09 re-processing the same record).
  entitlementGranted: { type: Boolean, default: false },
  purchaseToken: { type: String },
  // B12: schedules the next Play verification by entitlement state.
  nextVerificationAt: { type: Date },
  statusChangedAt: { type: Date },
  packageName: { type: String },
  subscriptionId: { type: String },
  createdOn: { type: Date, default: Date.now },
  updatedOn: { type: Date, default: Date.now },
  deletedOn: { type: Date },
},
{ timestamps: true });

TransactionRecordSchema.index(
  { appUserId: 1, status: 1, nextVerificationAt: 1, statusChangedAt: 1 },
  { partialFilterExpression: { purchaseToken: { $type: 'string' } } }
);
// B12: the cross-user sync cursor filters by active/failed status and due time;
// this index avoids fetching future subscription rows on every 15-minute run.
TransactionRecordSchema.index(
  { status: 1, nextVerificationAt: 1, appUserId: 1, statusChangedAt: 1 },
  { partialFilterExpression: { purchaseToken: { $type: 'string' } } }
);

const TransactionRecord = mongoose.model<ITransactionRecord>('TransactionRecord', TransactionRecordSchema);
export default TransactionRecord;
