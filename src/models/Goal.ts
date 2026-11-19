import { Schema, Document } from 'mongoose';
import {
  EmbeddedGoalCycleCompletionReportSchema,
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

const goalFields = {
  appUserId: { type: String, required: true },
  dateSet: { type: Date, required: true },
  targetedAverageNeckAngle: { type: Number, required: true },
  frequency: { type: String, required: true },
  goalCycleCompletionReports: [EmbeddedGoalCycleCompletionReportSchema],
  nextCycleEndsAt: { type: Date },
};

export const GoalSchema = new Schema<IGoal>(goalFields);

// B12: the cycle worker selects due goals by this field. Keep the due-goal
// scan indexed so it does not load and scan every goal as the collection grows.
GoalSchema.index({ nextCycleEndsAt: 1 });
GoalSchema.index({ appUserId: 1, dateSet: -1 });

// AppUser.goals is a legacy embedded copy; its subdocuments must not inherit
// the standalone Goal collection's query indexes.
export const EmbeddedGoalSchema = new Schema<IGoal>({
  ...goalFields,
  goalCycleCompletionReports: [EmbeddedGoalCycleCompletionReportSchema],
});

export const Goal = mongoose.models.Goal || mongoose.model<IGoal>('Goal', GoalSchema);
