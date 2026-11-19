import { Schema, Document, Types } from 'mongoose';
import mongoose from 'mongoose';
export interface IGoalCycleCompletionReport extends Document {
  actualAverageNeckAngle: number;
  complianceInPercentage: number;
  dateOfConcludedCycle: Date;
  goalId?: Types.ObjectId;
}

export const GoalCycleCompletionReportSchema = new Schema<IGoalCycleCompletionReport>({
  actualAverageNeckAngle: { type: Number, required: true },
  complianceInPercentage: { type: Number, required: true },
  dateOfConcludedCycle: { type: Date, required: true },
  goalId: { type: Schema.Types.ObjectId, ref: 'Goal' },
});

export const GoalCycleCompletionReport = mongoose.model<IGoalCycleCompletionReport>(
  'GoalCycleCompletionReport',
  GoalCycleCompletionReportSchema
);