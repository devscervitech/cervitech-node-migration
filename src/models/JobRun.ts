import mongoose, { Schema, Document } from 'mongoose';

export type JobRunStatus = 'running' | 'completed' | 'failed';

export interface IJobRun extends Document {
  job: string;
  monthKey: string;
  status: JobRunStatus;
  startedAt: Date;
  completedAt?: Date;
  durationMs?: number;
  totalFound?: number;
  sent?: number;
  failed?: number;
  errorSummary?: string;
}

const JobRunSchema: Schema = new Schema<IJobRun>(
  {
    job: { type: String, required: true },
    monthKey: { type: String, required: true },
    status: {
      type: String,
      enum: ['running', 'completed', 'failed'],
      required: true,
      default: 'running',
    },
    startedAt: { type: Date, required: true },
    completedAt: { type: Date },
    durationMs: { type: Number },
    totalFound: { type: Number },
    sent: { type: Number },
    failed: { type: Number },
    errorSummary: { type: String },
  },
  { timestamps: true }
);

// One record per job per month — the DB-level guard against duplicate runs.
JobRunSchema.index({ job: 1, monthKey: 1 }, { unique: true });

const JobRun = mongoose.models.JobRun || mongoose.model<IJobRun>('JobRun', JobRunSchema);

export default JobRun;