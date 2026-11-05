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
}
