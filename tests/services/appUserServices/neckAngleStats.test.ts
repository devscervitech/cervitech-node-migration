import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * B12: GET /neck-angle/stats used to load every reading a user ever posted
 * and filter in JS. These tests pin the rewritten version (bounded find +
 * two aggregations) to the exact output of the old algorithm, which is
 * re-implemented below as `legacyStats`.
 *
 * The mocked `find` applies whatever date filter the service actually sends,
 * so a window that is too narrow shows up as a mismatch. The mocked
 * `aggregate` applies the pipeline's own $match, then groups independently
 * of the service's band/month code.
 */

interface Reading {
  appUserId: string;
  angle: number;
  craniumVertebralAngle: number;
  dateTimeRecorded: Date;
}

let fixture: Reading[] = [];
const recordFind = vi.fn();
const recordAggregate = vi.fn();
const responseRateAggregate = vi.fn();

vi.mock('../../../src/models/AppUser', () => ({
  default: {
    findById: () => ({
      select: () => ({
        lean: () => ({ exec: () => Promise.resolve({ username: 'alice', responseRate: 72.25 }) }),
      }),
    }),
  },
}));

vi.mock('../../../src/models/Goal', () => ({
  Goal: {
    find: () => ({ sort: () => ({ limit: () => ({ lean: () => ({ exec: () => Promise.resolve([]) }) }) }) }),
  },
}));

vi.mock('../../../src/models/NeckAngleRecord', () => ({
  NeckAngleRecordModel: {
    find: (...args: unknown[]) => recordFind(...args),
    aggregate: (...args: unknown[]) => recordAggregate(...args),
  },
}));

vi.mock('../../../src/models/ResponseRate', () => ({
  default: { aggregate: (...args: unknown[]) => responseRateAggregate(...args) },
}));

import { NeckAngleService } from '../../../src/services/appUserServices/neckAngle.service';
import {
  STAR_RATING_BANDS,
  starRatingPipeline,
  starRatingPoints,
  monthlyTotalsPipeline,
  serverTimeZone,
} from '../../../src/services/appUserServices/neckAngleAggregations';
import { DateLibrary } from '../../../src/utils/dateLibrary';

type DateRange = { $gte?: Date; $lte?: Date; $lt?: Date };

function matches(r: Reading, filter: { appUserId: string; dateTimeRecorded?: DateRange }) {
  if (r.appUserId !== filter.appUserId) return false;
  const range = filter.dateTimeRecorded;
  if (!range) return true;
  const t = r.dateTimeRecorded.getTime();
  if (range.$gte && t < range.$gte.getTime()) return false;
  if (range.$lte && t > range.$lte.getTime()) return false;
  if (range.$lt && t >= range.$lt.getTime()) return false;
  return true;
}

/** The pre-B12 points chain, copied verbatim (independent of STAR_RATING_BANDS). */
function legacyPoints(angle: number | undefined): number {
  const a = angle ?? 0;
  if (a >= 10 && a <= 19) return 1;
  if (a >= 20 && a <= 29) return 2;
  if (a >= 30 && a <= 39) return 3;
  if (a >= 40 && a <= 49) return 4;
  if (a >= 50) return 5;
  return 0;
}

beforeEach(() => {
  vi.clearAllMocks();
  recordFind.mockImplementation((filter: any) => {
    const rows = fixture
      .filter((r) => matches(r, filter))
      .sort((a, b) => a.dateTimeRecorded.getTime() - b.dateTimeRecorded.getTime())
      .map(({ angle, craniumVertebralAngle, dateTimeRecorded }) => ({
        angle,
        craniumVertebralAngle,
        dateTimeRecorded,
      }));
    const query: any = {
      sort: () => query,
      select: () => query,
      lean: () => query,
      exec: () => Promise.resolve(rows),
    };
    return query;
  });
  recordAggregate.mockImplementation((pipeline: any[]) => {
    const rows = fixture.filter((r) => matches(r, pipeline[0].$match));
    const group = pipeline[1].$group;
    let result: unknown[];
    if (group._id === null) {
      result =
        rows.length === 0
          ? []
          : [
              {
                _id: null,
                count: rows.length,
                points: rows.reduce((s, r) => s + legacyPoints(r.angle), 0),
              },
            ];
    } else {
      const byMonth = new Map<number, { _id: number; total: number; count: number }>();
      for (const r of rows) {
        const month = r.dateTimeRecorded.getMonth() + 1; // server-local, like $month+timezone
        const g = byMonth.get(month) ?? { _id: month, total: 0, count: 0 };
        g.total += r.angle;
        g.count += 1;
        byMonth.set(month, g);
      }
      result = [...byMonth.values()];
    }
    return { exec: () => Promise.resolve(result) };
  });
  responseRateAggregate.mockReturnValue({
    exec: () => Promise.resolve([{ prompts: 400, responses: 289 }]),
  });
});

afterEach(() => {
  vi.useRealTimers();
});

/** The pre-B12 algorithm: every reading in memory, filtered in JS. */
function legacyStats(all: Reading[], today: Date) {
  const startOfDay = DateLibrary.startOfDay(today);
  const endOfDay = DateLibrary.endOfDay(today);
  const startOfWeek = DateLibrary.startOfWeek(today);
  const endOfWeek = DateLibrary.endOfWeek(today);
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  const records = all
    .filter((r) => r.appUserId === 'u1')
    .map(({ angle, craniumVertebralAngle, dateTimeRecorded }) => ({
      angle,
      craniumVertebralAngle,
      dateTimeRecorded,
    }));
  const safeAvg = (arr: typeof records) =>
    arr.length === 0 ? 0 : +(arr.reduce((s, a) => s + a.angle, 0) / arr.length).toFixed(1);
  const thisDay = records.filter((r) => r.dateTimeRecorded >= startOfDay && r.dateTimeRecorded <= endOfDay);
  const thisWeek = records.filter((r) => r.dateTimeRecorded >= startOfWeek && r.dateTimeRecorded <= endOfWeek);
  const thisMonth = records.filter(
    (r) => r.dateTimeRecorded.getMonth() === currentMonth && r.dateTimeRecorded.getFullYear() === currentYear
  );
  const thisYear = records.filter((r) => r.dateTimeRecorded.getFullYear() === currentYear);
  const totalPoint = records.reduce((s, r) => s + legacyPoints(r.angle), 0);
  return {
    averageNeckAngleStarRatingOver5:
      records.length === 0 ? 0 : +(totalPoint / records.length).toFixed(2),
    dailyNeckAngleRecords: thisDay,
    weeklyNeckAngleRecords: thisWeek,
    monthlyNeckAngleRecords: thisMonth,
    currentDayAverageNeckAngle: safeAvg(thisDay),
    currentWeekAverageNeckAngle: safeAvg(thisWeek),
    currentMonthAverageNeckAngle: safeAvg(thisMonth),
    averageNeckAngleForEachDayOfTheCurrentWeek: NeckAngleService.getEachDayOfTheWeekAverageNeckAngle(thisWeek),
    averageNeckAngleForEachMonthOfTheCurrentYear: NeckAngleService.getEachMonthOfTheYearAverageNeckAngle(thisYear),
  };
}

/** ~2 years of readings every ~7h for u1 (plus edge-band angles) and noise for u2. */
function buildFixture(): Reading[] {
  const out: Reading[] = [];
  const edges = [5, 9.5, 10, 19, 19.5, 20, 29.9, 30, 49, 49.5, 50, 90];
  let seed = 7;
  const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const start = new Date(2025, 0, 1, 0, 30).getTime();
  const end = new Date(2027, 0, 10, 23, 0).getTime();
  let i = 0;
  for (let t = start; t <= end; t += 7 * 60 * 60 * 1000 + 13 * 60 * 1000, i++) {
    const angle = i % 9 === 0 ? edges[i % edges.length] : Math.round(rand() * 900) / 10;
    out.push({ appUserId: 'u1', angle, craniumVertebralAngle: 90 - angle, dateTimeRecorded: new Date(t) });
    if (i % 5 === 0) {
      out.push({ appUserId: 'u2', angle: 3, craniumVertebralAngle: 87, dateTimeRecorded: new Date(t) });
    }
  }
  return out;
}

describe('computeNeckAngleParameters — B12 equivalence with the old in-memory algorithm', () => {
  const todays: [string, Date][] = [
    ['an ordinary mid-month day', new Date(2026, 10, 19, 12, 0)],
    ['a week that starts in the previous year', new Date(2027, 0, 1, 9, 0)],
    ['a week that runs into the next month', new Date(2026, 10, 30, 18, 0)],
  ];

  for (const [label, today] of todays) {
    it(`matches the old output on ${label}`, async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(today);
      fixture = buildFixture();

      const actual = await NeckAngleService.computeNeckAngleParameters('u1');

      expect(actual).toMatchObject(legacyStats(fixture, today));
      expect(actual.username).toBe('alice');
      expect(actual.responseRate).toBe(72.3);
      expect(actual.dailyNeckAngleRecords.length).toBeGreaterThan(0);
    });
  }

  it('fetches raw readings only inside a bounded date window, never the whole history', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 19, 12, 0));
    fixture = buildFixture();

    await NeckAngleService.computeNeckAngleParameters('u1');

    expect(recordFind).toHaveBeenCalledTimes(1);
    const filter = recordFind.mock.calls[0][0];
    expect(filter.appUserId).toBe('u1');
    expect(filter.dateTimeRecorded.$gte).toEqual(new Date(2026, 10, 1)); // start of month
    expect(filter.dateTimeRecorded.$lte).toEqual(new Date(2026, 10, 30, 23, 59, 59, 999));
    const fetched = fixture.filter((r) => matches(r, filter)).length;
    const lifetime = fixture.filter((r) => r.appUserId === 'u1').length;
    expect(fetched).toBeLessThan(lifetime / 10);
  });

  it('returns zeros for a user with no readings', async () => {
    fixture = [];

    const actual = await NeckAngleService.computeNeckAngleParameters('u1');

    expect(actual.averageNeckAngleStarRatingOver5).toBe(0);
    expect(actual.currentDayAverageNeckAngle).toBe(0);
    expect(actual.averageNeckAngleForEachMonthOfTheCurrentYear).toHaveLength(12);
    expect(actual.averageNeckAngleForEachMonthOfTheCurrentYear.every((m) => m.averageNeckAngle === 0)).toBe(true);
  });

  it('casts the response-rate owner ID for Mongo aggregation and preserves B4 rounding', async () => {
    const userId = '64f000000000000000000001';

    const actual = await NeckAngleService.computeNeckAngleParameters(userId);

    expect(responseRateAggregate).toHaveBeenCalledWith([
      { $match: { appUserId: expect.objectContaining({ _bsontype: 'ObjectId' }) } },
      {
        $group: {
          _id: null,
          prompts: { $sum: { $ifNull: ['$prompt', 0] } },
          responses: { $sum: { $ifNull: ['$response', 0] } },
        },
      },
    ]);
    expect(actual.responseRate).toBe(72.3);
  });
});

describe('neck-angle aggregation pipelines', () => {
  /** Evaluates the $and/$gte/$lte expressions the rating $switch uses. */
  function evaluate(expr: any, doc: { angle: number | null }): boolean {
    if (expr.$and) return expr.$and.every((e: any) => evaluate(e, doc));
    const [op, [, bound]] = Object.entries(expr)[0] as [string, [string, number]];
    const value = doc.angle;
    if (value === null) return false; // BSON: null sorts below every number
    return op === '$gte' ? value >= bound : value <= bound;
  }
  function pipelinePoints(angle: number | null): number {
    const $switch = (starRatingPipeline('u1')[1] as any).$group.points.$sum.$switch;
    const branch = $switch.branches.find((b: any) => evaluate(b.case, { angle }));
    return branch ? branch.then : $switch.default;
  }

  it('scores every angle exactly like the old if/else chain, gaps included', () => {
    const angles = [-1, 0, 5, 9.99, 10, 15, 19, 19.5, 20, 29, 29.5, 30, 39, 39.9, 40, 49, 49.01, 50, 75, 90, 180];
    for (const angle of angles) {
      expect(pipelinePoints(angle)).toBe(legacyPoints(angle));
      expect(starRatingPoints(angle)).toBe(legacyPoints(angle));
    }
    expect(pipelinePoints(null)).toBe(0);
    expect(STAR_RATING_BANDS).toHaveLength(5);
  });

  it('matches on the string user id (aggregate() does not cast through the schema)', () => {
    expect(starRatingPipeline('abc')[0]).toEqual({ $match: { appUserId: 'abc' } });
    const from = new Date(2026, 0, 1);
    const to = new Date(2027, 0, 1);
    expect(monthlyTotalsPipeline('abc', from, to, 'UTC')[0]).toEqual({
      $match: { appUserId: 'abc', dateTimeRecorded: { $gte: from, $lt: to } },
    });
  });

  it('buckets months in the server time zone that getMonth() uses', () => {
    const group = (monthlyTotalsPipeline('u1', new Date(), new Date(), serverTimeZone())[1] as any).$group;
    expect(group._id).toEqual({ $month: { date: '$dateTimeRecorded', timezone: serverTimeZone() } });
    expect(serverTimeZone()).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
  });
});
