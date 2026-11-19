import { AbbreviatedNeckAngleRecordViewModel } from "../viewmodels/AbbreviatedNeckAngleRecord.viewmodel";
import { DailyAngleDataViewModel } from "../viewmodels/DailyAngleData.viewmodel";

export class DateLibrary {
  static getCurrentDateTime(): Date {
    const now = new Date();
    now.setHours(now.getUTCHours() + 1);
    return now;
  }

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

  static addMinutesToCurrentTime(minutes: number): Date {
    const now = new Date();
    now.setHours(now.getUTCHours() + 1);
    now.setMinutes(now.getMinutes() + minutes);
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
    const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const firstMonday = new Date(firstDayOfMonth);
    const dayOffset = (8 - firstDayOfMonth.getDay()) % 7;
    firstMonday.setDate(firstDayOfMonth.getDate() + dayOffset);

    if (firstMonday > date) {
      const prevMonth = new Date(date.getFullYear(), date.getMonth() - 1, 1);
      const prevMonthMonday = new Date(prevMonth);
      const offset = (8 - prevMonth.getDay()) % 7;
      prevMonthMonday.setDate(prevMonth.getDate() + offset);
      return Math.floor((date.getTime() - prevMonthMonday.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
    }

    return Math.floor((date.getTime() - firstMonday.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
  }

  static startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  }

  static endOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
  }

  static startOfWeek(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay(); 
    const diff = (day === 0 ? -6 : 1) - day; 
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  static endOfWeek(date: Date): Date {
    const start = this.startOfWeek(date);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return end;
  }

  static formatDay(dateStr: string): string {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const daysMap = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return daysMap[date.getDay()];
  }


  static getEachDayOfWeekAverage(records: { angle: number; dateTimeRecorded: Date }[]) {
    const daysMap = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const grouped: { [key: number]: number[] } = {};

    for (const r of records) {
      const day = r.dateTimeRecorded.getDay(); 
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
