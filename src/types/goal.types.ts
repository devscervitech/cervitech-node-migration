import { GOAL_FREQUENCY } from '../enums/goalFrequency';
import { GoalCycleReportViewModel } from './goalCycleReport.types';

export interface TurnOnGoalViewModel {
  targetedAverageNeckAngle: number;
}

export interface SetGoalViewModel {
  targetedAverageNeckAngle: number;
  frequency: GOAL_FREQUENCY;
  goalCycleCompletionReports?: GoalCycleReportViewModel[];
}