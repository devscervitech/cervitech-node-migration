import mongoose, { Schema, Document } from 'mongoose';

export interface IResponseRate extends Document {
  appUserId: number;
  prompt: number;
  response: number;
  dateCreated: Date;
}

const ResponseRateSchema = new Schema<IResponseRate>({
  appUserId: { type: Number, required: true },
  prompt: { type: Number, required: true },
  response: { type: Number, required: true },
  dateCreated: { type: Date, default: Date.now },
});

const ResponseRate = mongoose.models.ResponseRate || mongoose.model('ResponseRate', ResponseRateSchema);

export default ResponseRate;
