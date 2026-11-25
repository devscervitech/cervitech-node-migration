import { Schema, Document } from 'mongoose';
import mongoose from 'mongoose';
import { GOAL_FREQUENCY } from '../enums/goalFrequency';


export interface IGoal extends Document {
  appUserId: string;
  dateSet: Date;
  targetedAverageNeckAngle: number;
  frequency: string;
  nextCycleEndsAt?: Date | null;
}

export const GoalSchema = new Schema<IGoal>({
  appUserId: { type: String, required: true },
  dateSet: { type: Date, required: true },
  targetedAverageNeckAngle: { type: Number, required: true },
  frequency: { type: String, required: true, enum: Object.values(GOAL_FREQUENCY) },
  nextCycleEndsAt: { type: Date },
});

GoalSchema.index({ appUserId: 1, dateSet: -1, _id: -1 });

export const Goal = mongoose.models.Goal || mongoose.model<IGoal>('Goal', GoalSchema);
