export class DateLibrary {
  static getCurrentDateTime(): Date {
    const d = new Date();
    d.setHours(d.getUTCHours() + 1);
    return d;
  }

  static getDaySet(): string {
    const daysMap: Record<string, string> = {
      Monday: 'Mon',
      Tuesday: 'Tue',
      Wednesday: 'Wed',
      Thursday: 'Thur',
      Friday: 'Fri',
      Saturday: 'Sat',
      Sunday: 'Sun'
    };
    const dayName = new Date().toLocaleString('en-US', { weekday: 'long', timeZone: 'UTC' });
    return daysMap[dayName] ?? 'Sun';
  }

  static getYesterdayDateTime(): Date {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 1);
    return d;
  }

  static getLastWeekDateTime(): Date {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 7);
    return d;
  }

  static addMinutesToCurrentTime(minutes: number): Date {
    const d = this.getCurrentDateTime();
    d.setMinutes(d.getMinutes() + minutes);
    return d;
  }

  static addDaysToCurrentTime(days: number): Date {
    const d = this.getCurrentDateTime();
    d.setDate(d.getDate() + days);
    return d;
  }

  static addMonthsToCurrentTime(months: number): Date {
    const d = this.getCurrentDateTime();
    d.setMonth(d.getMonth() + months);
    return d;
  }

  static addYearsToCurrentTime(years: number): Date {
    const d = this.getCurrentDateTime();
    d.setFullYear(d.getFullYear() + years);
    return d;
  }

  static getWeekNumberOfMonth(date: Date): number {
    // ensure no time portion
    const dt = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    let firstMonthDay = new Date(dt.getFullYear(), dt.getMonth(), 1);
    // find first Monday of the month
    let firstMonthMonday = new Date(firstMonthDay);
    const offset = (1 + 7 - firstMonthDay.getDay()) % 7; // 1 = Monday
    firstMonthMonday.setDate(firstMonthDay.getDate() + offset);

    if (firstMonthMonday > dt) {
      // go to previous month
      firstMonthDay = new Date(dt.getFullYear(), dt.getMonth() - 1, 1);
      firstMonthMonday = new Date(firstMonthDay);
      const offsetPrev = (1 + 7 - firstMonthDay.getDay()) % 7;
      firstMonthMonday.setDate(firstMonthDay.getDate() + offsetPrev);
    }

    return Math.floor((dt.getTime() - firstMonthMonday.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
  }
}
