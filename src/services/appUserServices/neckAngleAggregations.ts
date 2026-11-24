import type { PipelineStage } from 'mongoose';

/**
 * B12: aggregation pipelines for GET /neck-angle/stats. These replace
 * loading a user's entire reading history into Node and filtering it in JS.
 *
 * NeckAngleRecord.appUserId is stored as a string, and aggregate() does not
 * cast through the schema — callers must pass the id as a string.
 */

/**
 * Star-rating points for one reading. Mirrors the bands the stats endpoint
 * has always used, including the gaps (e.g. 19.5 scores 0). Kept here so the
 * pipeline below and the tests share one definition.
 */
export const STAR_RATING_BANDS: { min: number; max?: number; points: number }[] = [
  { min: 10, max: 19, points: 1 },
  { min: 20, max: 29, points: 2 },
  { min: 30, max: 39, points: 3 },
  { min: 40, max: 49, points: 4 },
  { min: 50, points: 5 },
];

export function starRatingPoints(angle: number | null | undefined): number {
  const a = angle ?? 0;
  const band = STAR_RATING_BANDS.find((b) => a >= b.min && (b.max === undefined || a <= b.max));
  return band?.points ?? 0;
}

/** Lifetime star-rating totals → one `{ points, count }` document (or none). */
export function starRatingPipeline(appUserId: string): PipelineStage[] {
  return [
    { $match: { appUserId } },
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        points: {
          $sum: {
            $switch: {
              branches: STAR_RATING_BANDS.map((band) => ({
                case:
                  band.max === undefined
                    ? { $gte: ['$angle', band.min] }
                    : { $and: [{ $gte: ['$angle', band.min] }, { $lte: ['$angle', band.max] }] },
                then: band.points,
              })),
              default: 0,
            },
          },
        },
      },
    },
  ];
}

/**
 * Per-calendar-month angle totals within [from, to), bucketed in `timezone`
 * so the months line up with the server-local `getMonth()` the endpoint has
 * always used. Emits `{ _id: 1..12, total, count }`.
 */
export function monthlyTotalsPipeline(
  appUserId: string,
  from: Date,
  to: Date,
  timezone: string
): PipelineStage[] {
  return [
    { $match: { appUserId, dateTimeRecorded: { $gte: from, $lt: to } } },
    {
      $group: {
        _id: { $month: { date: '$dateTimeRecorded', timezone } },
        total: { $sum: '$angle' },
        count: { $sum: 1 },
      },
    },
  ];
}

/** IANA zone of this process, i.e. the zone `Date#getMonth()` uses. */
export function serverTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}
