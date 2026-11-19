import mongoose, { Schema } from 'mongoose';

export interface IAuthRateLimitBucket {
  bucketKey: string;
  count: number;
  expiresAt: Date;
}

const AuthRateLimitBucketSchema = new Schema<IAuthRateLimitBucket>(
  {
    bucketKey: { type: String, required: true },
    count: { type: Number, required: true, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  { versionKey: false }
);

AuthRateLimitBucketSchema.index({ bucketKey: 1 }, { unique: true });
AuthRateLimitBucketSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.models.AuthRateLimitBucket ||
  mongoose.model<IAuthRateLimitBucket>('AuthRateLimitBucket', AuthRateLimitBucketSchema);
