import mongoose, { Document, Schema } from 'mongoose';

export interface IJobLease extends Document {
  job: string;
  ownerToken: string;
  leaseUntil: Date;
  heartbeatAt: Date;
}

const JobLeaseSchema = new Schema<IJobLease>(
  {
    job: { type: String, required: true },
    ownerToken: { type: String, required: true },
    leaseUntil: { type: Date, required: true },
    heartbeatAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// One durable lease row per scheduled job. The row is reused after expiry;
// a unique index makes acquisition atomic across replicas.
JobLeaseSchema.index({ job: 1 }, { unique: true });

const JobLease = mongoose.models.JobLease || mongoose.model<IJobLease>('JobLease', JobLeaseSchema);
export default JobLease;
