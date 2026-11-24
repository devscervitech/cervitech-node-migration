import { AbbreviatedNeckAngleRecordViewModel } from "../viewmodels/AbbreviatedNeckAngleRecord.viewmodel";
import { DailyAngleDataViewModel } from "../viewmodels/DailyAngleData.viewmodel";

export class DateLibrary {

  static getDaySet(): string {
    const day = new Date().getUTCDay(); // 0 = Sunday, 1 = Monday, ...
    const daysMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thur', 'Fri', 'Sat'];
    return daysMap[day];
  }

  static getYesterdayDateTime(): Date {
    const now = new Date();
    now.setUTCDate(now.getUTCDate() - 1);
    return now;
  }

  static getLastWeekDateTime(): Date {
    const now = new Date();
    now.setUTCDate(now.getUTCDate() - 7);
    return now;
  }


  static addDaysToCurrentTime(days: number): Date {
    const now = new Date();
    now.setUTCDate(now.getUTCDate() + days);
    return now;
  }

  static addMonthsToCurrentTime(months: number): Date {
    const now = new Date();
    now.setUTCMonth(now.getUTCMonth() + months);
    return now;
  }

  static addYearsToCurrentTime(years: number): Date {
    const now = new Date();
    now.setUTCFullYear(now.getUTCFullYear() + years);
    return now;
  }

  static getWeekNumberOfMonth(date: Date): number {
    if (Number.isNaN(date.getTime())) throw new Error('Invalid date');
    const firstDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
    const mondayOffset = (firstDay.getUTCDay() + 6) % 7;
    return Math.floor((date.getUTCDate() - 1 + mondayOffset) / 7) + 1;
  }





  static formatDay(dateStr: string): string {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const daysMap = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return daysMap[date.getUTCDay()];
  }


  static getEachDayOfWeekAverage(records: { angle: number; dateTimeRecorded: Date }[]) {
    const daysMap = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const grouped: { [key: number]: number[] } = {};

    for (const r of records) {
      const day = r.dateTimeRecorded.getUTCDay();
      if (!grouped[day]) grouped[day] = [];
      grouped[day].push(r.angle);
    }

    return Object.keys(grouped).map(dayNum => {
      const values = grouped[+dayNum];
      const avg = values.reduce((s, v) => s + v, 0) / values.length;
      return {
        day: daysMap[+dayNum],
        averageNeckAngle: +avg.toFixed(1)
      };
    });
  }

}
