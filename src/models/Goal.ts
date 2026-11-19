import { Schema, Document } from 'mongoose';
import {
  GoalCycleCompletionReportSchema,
  IGoalCycleCompletionReport,} from './GoalCycleCompletionReport';
import mongoose from 'mongoose';


export interface IGoal extends Document {
  appUserId: string;
  dateSet: Date;
  targetedAverageNeckAngle: number;
  frequency: string;
  goalCycleCompletionReports: IGoalCycleCompletionReport[];
  nextCycleEndsAt?: Date;
}

export const GoalSchema = new Schema<IGoal>({
  appUserId: { type: String, required: true, index: true },
  dateSet: { type: Date, required: true },
  targetedAverageNeckAngle: { type: Number, required: true },
  frequency: { type: String, required: true },
  goalCycleCompletionReports: [GoalCycleCompletionReportSchema],
  nextCycleEndsAt: { type: Date },
});

export const Goal = mongoose.models.Goal || mongoose.model<IGoal>('Goal', GoalSchema);