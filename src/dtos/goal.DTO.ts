import { GOAL_FREQUENCY } from '../enums/goalFrequency';
import { GoalCycleReportViewModel } from './GoalCycleReport.DTO';

export interface TurnOnGoalViewModel {
  appUserId: string;
  targetedAverageNeckAngle: number;
}


export interface SetGoalViewModel {
  appUserId: string;
  targetedAverageNeckAngle: number;
  frequency: GOAL_FREQUENCY;
  goalCycleCompletionReports: GoalCycleReportViewModel[];
}
