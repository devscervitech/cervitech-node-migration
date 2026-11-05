import type { INeckAngleRecord } from './NeckAngleRecord';

export interface NeckAngleModel {
  appUserId: number;
  angles: number;
  neckAngleRecords: INeckAngleRecord[];
}