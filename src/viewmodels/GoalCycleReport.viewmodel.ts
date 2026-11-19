export interface GoalCycleReportViewModel {
  frequency?: string | null;
  targetedAverageNeckAngle?: number | null;
  actualAverageNeckAngle?: number | null;
  complianceInPercentage?: number | null;
  dateOfConcludedCycle?: Date | null;
  dayOfConcludedCycle?: string | null;
  colorTag?: string | null;
}
