export interface GoalCycleReportViewModel {
  id: number;
  appUserId: string;
  frequency: string;
  targetedAverageNeckAngle?: number;
  actualAverageNeckAngle?: number;
  complianceInPercentage?: number;
  colorTag: string;
  dateOfConcludedCycle?: Date;
  dayOfConcludedCycle: string;
}
