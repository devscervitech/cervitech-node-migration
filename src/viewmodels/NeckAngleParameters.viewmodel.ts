import { AbbreviatedNeckAngleRecordViewModel } from './AbbreviatedNeckAngleRecord.viewmodel';
import { DailyAngleDataViewModel } from './DailyAngleData.viewmodel';
import { GoalCycleReportViewModel } from './GoalCycleReport.viewmodel';

export interface NeckAngleParametersViewModel {
  username: string;
  averageNeckAngleStarRatingOver5: number;
  responseRate: number;
  lastSetGoalWithDetails?: GoalCycleReportViewModel | null;
  dailyNeckAngleRecords: AbbreviatedNeckAngleRecordViewModel[];
  weeklyNeckAngleRecords: AbbreviatedNeckAngleRecordViewModel[];
  monthlyNeckAngleRecords: AbbreviatedNeckAngleRecordViewModel[];
  currentDayAverageNeckAngle: number;
  currentWeekAverageNeckAngle: number;
  currentMonthAverageNeckAngle: number;
  bestWeekDayAverageNeckAngle?: DailyAngleDataViewModel | null;
  badWeekDayAverageNeckAngle?: DailyAngleDataViewModel | null;
  averageNeckAngleForEachDayOfTheCurrentWeek: DailyAngleDataViewModel[];
  averageNeckAngleForEachWeekOfTheCurrentMonth: { weekNumber: number; averageNeckAngle: number }[];
  averageNeckAngleForEachMonthOfTheCurrentYear: { month: string; averageNeckAngle: number }[];
  currentDayAverageNeckAngleTextReport: string;
}