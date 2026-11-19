import type { INeckAngleRecord } from './NeckAngleRecord';

export interface NeckAngleModel {
  appUserId: string;
  angles: number;
  neckAngleRecords: INeckAngleRecord[];
}