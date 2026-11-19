import { Schema, model } from 'mongoose';

export interface IOtpCode {
  email: string;
  code: string;
  purpose: string;
  attempts: number;
  expiresAt: Date;
  createdAt: Date;
}

const OtpCodeSchema = new Schema<IOtpCode>({
  email: { type: String, required: true, index: true },
  code: { type: String, required: true },
  purpose: { type: String, required: true },
  attempts: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now, expires: '30m' },
});

const OtpCode = model<IOtpCode>('OtpCode', OtpCodeSchema);
export default OtpCode;
