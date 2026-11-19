import { Schema, Document } from 'mongoose';
import mongoose from 'mongoose';

export interface INeckAngleRecord extends Document {
  appUserId: string;
  angle: number;
  craniumVertebralAngle: number;
  dateTimeRecorded: Date;
  counter: number;
}

const neckAngleRecordFields = {
  appUserId: { type: String, ref: 'AppUser', required: true },
  angle: { type: Number, required: true },
  craniumVertebralAngle: { type: Number, required: true },
  dateTimeRecorded: { type: Date, required: true },
  counter: { type: Number, required: true },
};

export const NeckAngleRecordSchema = new Schema<INeckAngleRecord>(neckAngleRecordFields);

// B12: every read of this collection filters on one user and (usually) a
// recorded-at range — the stats endpoint, the charts, the reminder jobs and
// the goal-cycle summary. Without this index each of those is a collection scan.
NeckAngleRecordSchema.index({ appUserId: 1, dateTimeRecorded: -1 });
// Counter is the sequence source for prompt thresholds and for lazy seeding
// existing accounts before the migration has populated their counter field.
NeckAngleRecordSchema.index({ appUserId: 1, counter: -1 });

/**
 * Index-free copy of the record shape for the deprecated `AppUser.neckAngleRecords`
 * array. Mongoose propagates a sub-schema's indexes to the parent collection,
 * so embedding `NeckAngleRecordSchema` itself would also build a useless
 * multikey index on `appusers`.
 */
export const EmbeddedNeckAngleRecordSchema = new Schema<INeckAngleRecord>(neckAngleRecordFields);

export const NeckAngleRecordModel = mongoose.model<INeckAngleRecord>(
  'NeckAngleRecord',
  NeckAngleRecordSchema
);
