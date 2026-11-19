import mongoose, { Schema, Document } from 'mongoose';

export type JobRunStatus = 'running' | 'completed' | 'failed';

export interface IJobRun extends Document {
  job: string;
  /**
   * The period this run covers. For monthlyReminder it is a YYYY-MM month;
   * for the interval jobs guarded by jobs/jobLock.ts it is the UTC minute of
   * the scheduled slot (YYYY-MM-DDTHH:mm). The field name predates that
   * generalisation — renaming it would mean rebuilding the unique index.
   */
  monthKey: string;
  status: JobRunStatus;
  startedAt: Date;
  completedAt?: Date;
  durationMs?: number;
  totalFound?: number;
  sent?: number;
  failed?: number;
  errorSummary?: string;
  /** When set, the TTL index removes the record after this time. */
  expiresAt?: Date;
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
    expiresAt: { type: Date },
  },
  { timestamps: true }
);

// One record per job per month — the DB-level guard against duplicate runs.
JobRunSchema.index({ job: 1, monthKey: 1 }, { unique: true });
// Slot locks for the 15-minute / 2-hourly jobs would otherwise accumulate
// forever. Records without expiresAt (the monthly ledger) never expire.
JobRunSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const JobRun = mongoose.models.JobRun || mongoose.model<IJobRun>('JobRun', JobRunSchema);

export default JobRun;