import {it,expect} from 'vitest';
import {DateLibrary} from '../../src/utils/dateLibrary';
import {startOfDayUtc,endOfDayUtc,startOfWeekUtc,endOfWeekUtc,computeFirstCycleEndsAt} from '../../src/services/goalCycle';
it('uses UTC boundaries at midnight across host timezones',()=>{
 const date=new Date('2026-11-01T23:30:00Z');
 expect(startOfDayUtc(date).toISOString()).toBe('2026-11-01T00:00:00.000Z');
 expect(endOfDayUtc(date).toISOString()).toBe('2026-11-01T23:59:59.999Z');
 expect(startOfWeekUtc(date).toISOString()).toBe('2026-10-26T00:00:00.000Z');
 expect(endOfWeekUtc(date)).toEqual(computeFirstCycleEndsAt(date,'WEEKLY'));
});
it('assigns partial first and sixth weeks within their month',()=>{
 expect(DateLibrary.getWeekNumberOfMonth(new Date('2026-03-01T00:00:00Z'))).toBe(1);
 expect(DateLibrary.getWeekNumberOfMonth(new Date('2026-03-30T23:00:00Z'))).toBe(6);
 expect(DateLibrary.getWeekNumberOfMonth(new Date('2026-03-31T23:59:59Z'))).toBe(6);
 expect(DateLibrary.getWeekNumberOfMonth(new Date('2026-04-01T00:00:00Z'))).toBe(1);
});
