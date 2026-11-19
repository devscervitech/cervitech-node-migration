// types/AutomatePostNeckAngleRecordsViewModel.ts
interface NeckAngleTestValue {
  timestamp: Date;
  angle: number;
  postureStatus: 'Good' | 'Bad' | 'Neutral'; // example enum-like values
}

export interface AutomatePostNeckAngleRecordsViewModel {
  appUserId: string;
  startDate: Date;
  endDate: Date;
  numberOfRecords: number;
  testValues: NeckAngleTestValue[];
}
