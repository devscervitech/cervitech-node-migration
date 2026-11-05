import { Schema, Document } from 'mongoose';
import mongoose from 'mongoose';
export interface IGoalCycleCompletionReport extends Document {
  actualAverageNeckAngle: number;
  complianceInPercentage: number;
  dateOfConcludedCycle: Date;
}

export const GoalCycleCompletionReportSchema = new Schema<IGoalCycleCompletionReport>({
  actualAverageNeckAngle: { type: Number, required: true },
  complianceInPercentage: { type: Number, required: true },
  dateOfConcludedCycle: { type: Date, required: true },
});

export const GoalCycleCompletionReport = mongoose.model<IGoalCycleCompletionReport>(
  'GoalCycleCompletionReport',
  GoalCycleCompletionReportSchema
);