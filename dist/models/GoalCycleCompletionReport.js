import { Schema } from 'mongoose';
import mongoose from 'mongoose';
export const GoalCycleCompletionReportSchema = new Schema({
    actualAverageNeckAngle: { type: Number, required: true },
    complianceInPercentage: { type: Number, required: true },
    dateOfConcludedCycle: { type: Date, required: true },
});
export const GoalCycleCompletionReport = mongoose.model('GoalCycleCompletionReport', GoalCycleCompletionReportSchema);
