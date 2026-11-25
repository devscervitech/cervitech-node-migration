import { GOAL_FREQUENCY } from '../enums/goalFrequency';

export interface TurnOnGoalViewModel {
  targetedAverageNeckAngle: number;
}

export interface SetGoalViewModel {
  targetedAverageNeckAngle: number;
  frequency: GOAL_FREQUENCY;
}
