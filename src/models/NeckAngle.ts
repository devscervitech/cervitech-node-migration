export interface NeckAngleRecordInput {
  appUserId: string;
  angle: number;
  dateTimeRecorded: Date;
}

export interface NeckAngleModel {
  neckAngleRecords: NeckAngleRecordInput[];
}
