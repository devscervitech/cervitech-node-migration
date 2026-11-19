import { Schema, Document, Types } from 'mongoose';
import mongoose from 'mongoose';
export interface IGoalCycleCompletionReport extends Document {
  actualAverageNeckAngle: number;
  complianceInPercentage: number;
  dateOfConcludedCycle: Date;
  goalId?: Types.ObjectId;
}

const goalCycleCompletionReportFields = {
  actualAverageNeckAngle: { type: Number, required: true },
  complianceInPercentage: { type: Number, required: true },
  dateOfConcludedCycle: { type: Date, required: true },
  goalId: { type: Schema.Types.ObjectId, ref: 'Goal' },
};

export const GoalCycleCompletionReportSchema = new Schema<IGoalCycleCompletionReport>(
  goalCycleCompletionReportFields
);

// Reports are idempotently keyed by goal and cycle. The partial filter keeps
// legacy reports without a goalId outside the unique constraint.
GoalCycleCompletionReportSchema.index(
  { goalId: 1, dateOfConcludedCycle: 1 },
  { unique: true, partialFilterExpression: { goalId: { $exists: true } } }
);

// This shape is embedded under AppUser.goals. Keep it index-free so the
// standalone report's compound index is not copied onto the users collection.
export const EmbeddedGoalCycleCompletionReportSchema =
  new Schema<IGoalCycleCompletionReport>(goalCycleCompletionReportFields);

export const GoalCycleCompletionReport = mongoose.model<IGoalCycleCompletionReport>(
  'GoalCycleCompletionReport',
  GoalCycleCompletionReportSchema
);
