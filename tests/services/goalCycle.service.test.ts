import { describe, it, expect } from 'vitest';
import {
  computeFirstCycleEndsAt,
  advanceCycleEndsAt,
  computeCycleWindow,
  computeCompliance,
  buildGoalCyclePushPayload,
} from '../../src/services/goalCycle';

describe('goalCycle — cycle boundaries', () => {
  it('DAILY first cycle ends at UTC end of the calendar day of dateSet', () => {
    const dateSet = new Date('2026-08-12T14:30:00Z');
    const end = computeFirstCycleEndsAt(dateSet, 'DAILY');
    expect(end.toISOString()).toBe('2026-08-12T23:59:59.999Z');
  });

  it('WEEKLY first cycle ends at UTC end of the Monday-start week containing dateSet', () => {
    const dateSet = new Date('2026-08-13T14:30:00Z'); // Thursday
    const end = computeFirstCycleEndsAt(dateSet, 'WEEKLY');
    expect(end.toISOString()).toBe('2026-08-16T23:59:59.999Z'); // Sunday
  });

  it('advanceCycleEndsAt adds 24h for DAILY and 7 days for WEEKLY', () => {
    const end = new Date('2026-08-12T23:59:59.999Z');
    expect(advanceCycleEndsAt(end, 'DAILY').toISOString()).toBe('2026-08-13T23:59:59.999Z');
    expect(advanceCycleEndsAt(end, 'WEEKLY').toISOString()).toBe('2026-08-19T23:59:59.999Z');
  });

  it('computeCycleWindow spans exactly one full cycle before cycleEndsAt', () => {
    const end = new Date('2026-08-12T23:59:59.999Z');
    const window = computeCycleWindow(end, 'DAILY');
    expect(window.end.toISOString()).toBe('2026-08-12T23:59:59.999Z');
    expect(window.start.toISOString()).toBe('2026-08-11T23:59:59.999Z');
  });

  it('computeCycleWindow for WEEKLY spans 7 days', () => {
    const end = new Date('2026-08-16T23:59:59.999Z');
    const window = computeCycleWindow(end, 'WEEKLY');
    expect(window.start.toISOString()).toBe('2026-08-09T23:59:59.999Z');
  });
});

describe('goalCycle — compliance', () => {
  it('scores 100 when average meets or beats the target', () => {
    expect(computeCompliance(80, 75)).toBe(100);
    expect(computeCompliance(75, 75)).toBe(100);
  });

  it('scores average/target rounded to 1dp and capped at 100', () => {
    expect(computeCompliance(60, 80)).toBe(75);
    expect(computeCompliance(1, 80)).toBe(1.3);
  });

  it('handles zero target and zero average without dividing by zero', () => {
    expect(computeCompliance(50, 0)).toBe(0);
    expect(computeCompliance(0, 80)).toBe(0);
  });
});

describe('goalCycle — push payload', () => {
  it('builds the goal_cycle_report push for a WEEKLY goal with score copy', () => {
    const payload = buildGoalCyclePushPayload(78.5, 'WEEKLY');
    expect(payload.title).toBe('Your goal report 🎯');
    expect(payload.body).toBe('You scored 78.5/100 this week — keep it up!');
    expect(payload.data).toEqual({ type: 'goal_cycle_report', frequency: 'WEEKLY' });
  });

  it('builds the goal_cycle_report push for a DAILY goal with today copy', () => {
    const payload = buildGoalCyclePushPayload(100, 'DAILY');
    expect(payload.body).toBe('You scored 100/100 today — keep it up!');
    expect(payload.data).toEqual({ type: 'goal_cycle_report', frequency: 'DAILY' });
  });
});
