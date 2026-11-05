import { Schema } from 'mongoose';
import mongoose from 'mongoose';
export const NeckAngleRecordSchema = new Schema({
    appUserId: { type: String, ref: 'User', required: true },
    angle: { type: Number, required: true },
    craniumVertebralAngle: { type: Number, required: true },
    dateTimeRecorded: { type: Date, required: true },
    counter: { type: Number, required: true },
});
export const NeckAngleRecordModel = mongoose.model('NeckAngleRecord', NeckAngleRecordSchema);
