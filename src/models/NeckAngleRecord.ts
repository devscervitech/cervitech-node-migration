import { Schema, Document } from 'mongoose';
import mongoose from 'mongoose';

export interface INeckAngleRecord extends Document {
  appUserId: string;
  angle: number;
  craniumVertebralAngle: number;
  dateTimeRecorded: Date;
  counter: number;
} 

export const NeckAngleRecordSchema = new Schema<INeckAngleRecord>({
  appUserId: { type: String, ref: 'User', required: true },
  angle: { type: Number, required: true },
  craniumVertebralAngle: { type: Number, required: true },
  dateTimeRecorded: { type: Date, required: true },
  counter: { type: Number, required: true },
});


export const NeckAngleRecordModel = mongoose.model<INeckAngleRecord>(
  'NeckAngleRecord',
  NeckAngleRecordSchema
);