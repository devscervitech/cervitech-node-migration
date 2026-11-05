import { Schema } from 'mongoose';
import { GoalCycleCompletionReportSchema, } from './GoalCycleCompletionReport';
import mongoose from 'mongoose';
export const GoalSchema = new Schema({
    dateSet: { type: Date, required: true },
    targetedAverageNeckAngle: { type: Number, required: true },
    frequency: { type: String, required: true },
    goalCycleCompletionReports: {
        type: [GoalCycleCompletionReportSchema],
        default: [],
    },
});
export const Goal = mongoose.model('Goal', GoalSchema);
