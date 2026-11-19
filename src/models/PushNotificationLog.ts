import { Schema, Document } from 'mongoose';
import mongoose from 'mongoose';

export type PushLogStatus = 'pending' | 'delivered' | 'failed';

export interface IPushNotificationLog extends Document {
  token: string;
  title: string;
  dataType?: string;
  ticketId?: string;
  status: PushLogStatus;
  error?: string;
  sentAt: Date;
  deliveredAt?: Date;
}

export const PushNotificationLogSchema = new Schema<IPushNotificationLog>({
  token: { type: String, required: true },
  title: { type: String, required: true },
  dataType: { type: String },
  ticketId: { type: String },
  status: {
    type: String,
    enum: ['pending', 'delivered', 'failed'],
    default: 'pending',
    required: true,
  },
  error: { type: String },
  sentAt: { type: Date, default: Date.now, required: true },
  deliveredAt: { type: Date },
});

export const PushNotificationLog =
  mongoose.models.PushNotificationLog ||
  mongoose.model<IPushNotificationLog>('PushNotificationLog', PushNotificationLogSchema);
