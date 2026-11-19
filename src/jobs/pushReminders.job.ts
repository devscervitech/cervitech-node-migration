import AppUser from '../models/AppUser';
import { NeckAngleRecordModel } from '../models/NeckAngleRecord';
import { PushNotificationDriver } from '../services/pushNotificationDriver';
import { PushNotificationModelDTO } from '../types/pushNotificationModel.types';
import { scheduleExclusiveJob } from './jobLock';

// Throttling: never re-send the same nudge to the same user more often
// than this, regardless of how often the cron itself runs.
const GOAL_REMINDER_COOLDOWN_HOURS = 72;
const CHECKIN_REMINDER_COOLDOWN_HOURS = 24;
const GOAL_PROGRESS_COOLDOWN_HOURS = 6;
const BAD_POSTURE_COOLDOWN_HOURS = 3;

// Give a brand-new signup a day before nagging them to set a goal.
const MIN_ACCOUNT_AGE_HOURS = 24;
// "Been a while" threshold for a check-in nudge.
const CHECKIN_STALE_HOURS = 24;
// Rolling window a "how's my posture right now" check looks back over.
const RECENT_WINDOW_MINUTES = 60;
// Minimum samples in that window before acting on it — one stray low
// reading shouldn't trigger an alert.
const MIN_SAMPLES_FOR_ALERT = 3;
// Score below which a recent-window average counts as "bad" (matches the
// "Poor" cutoff in src/utils/utils.ts -> compareAverageNeckAngle).
const BAD_POSTURE_SCORE_THRESHOLD = 30;

// B12: candidates are streamed and handled this many at a time — one
// readings query and one push batch per chunk instead of one query per user.
export const CANDIDATE_CHUNK_SIZE = 500;

/**
 * Users with a usable push token. AuthService.logout and registration write
 * `''` rather than unsetting the field, so `$ne: null` alone let logged-out
 * users through to be discarded later by the driver.
 */
export const HAS_PUSH_TOKEN = { $type: 'string', $gt: '' };

function hoursBefore(now: Date, hours: number): Date {
  return new Date(now.getTime() - hours * 60 * 60 * 1000);
}

/** Never sent, or last sent before `cutoff` (the old isDue(), in the query). */
function notSentSince(field: string, cutoff: Date) {
  return { $or: [{ [field]: null }, { [field]: { $lt: cutoff } }] };
}

type Candidate = {
  _id: unknown;
  fcmToken: string;
  isGoalOn?: boolean;
  goals?: { dateSet: Date; targetedAverageNeckAngle: number }[];
};

export type ReminderRunSummary = { due: number; sent: number };

async function forEachCandidateChunk(
  filter: Record<string, unknown>,
  fields: string,
  handle: (chunk: Candidate[]) => Promise<void>,
  signal?: AbortSignal
): Promise<void> {
  const cursor = AppUser.find(filter).select(fields).lean().cursor();
  let chunk: Candidate[] = [];
  try {
    for await (const user of cursor) {
      if (signal?.aborted) throw signal.reason ?? new Error('Push reminder job was aborted.');
      chunk.push(user as unknown as Candidate);
      if (chunk.length >= CANDIDATE_CHUNK_SIZE) {
        await handle(chunk);
        chunk = [];
      }
    }
    if (chunk.length > 0) await handle(chunk);
  } finally {
    await cursor.close().catch(() => {});
  }
}

/** Sends the batch and stamps `stampField` on every user Expo accepted. */
async function sendAndStamp(
  users: Candidate[],
  messages: PushNotificationModelDTO[],
  stampField: string,
  now: Date,
  signal?: AbortSignal
): Promise<number> {
  if (messages.length === 0) return 0;
  if (signal?.aborted) throw signal.reason ?? new Error('Push reminder job was aborted.');
  const results = await PushNotificationDriver.sendBatch(messages);
  const deliveredIds = users.filter((_, i) => results.delivered[i]).map((u) => u._id);
  if (deliveredIds.length > 0) {
    await AppUser.updateMany({ _id: { $in: deliveredIds } }, { $set: { [stampField]: now } });
  }
  return deliveredIds.length;
}

/** Per-user angle totals over [windowStart, now] for one chunk of users. */
async function recentAngleTotals(
  userIds: string[],
  windowStart: Date
): Promise<Map<string, { total: number; count: number }>> {
  if (userIds.length === 0) return new Map();
  const rows = await NeckAngleRecordModel.aggregate<{ _id: string; total: number; count: number }>([
    { $match: { appUserId: { $in: userIds }, dateTimeRecorded: { $gte: windowStart } } },
    { $group: { _id: '$appUserId', total: { $sum: '$angle' }, count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [r._id, { total: r.total, count: r.count }]));
}

/** Nudges users who signed up but never turned a goal on. */
export async function runGoalReminder(now: Date = new Date(), signal?: AbortSignal): Promise<ReminderRunSummary> {
  const summary = { due: 0, sent: 0 };
  await forEachCandidateChunk(
    {
      isGoalOn: false,
      fcmToken: HAS_PUSH_TOKEN,
      allowPushNotifications: true,
      deleted: { $ne: true },
      dateRegistered: { $lt: hoursBefore(now, MIN_ACCOUNT_AGE_HOURS) },
      ...notSentSince('lastGoalReminderSentAt', hoursBefore(now, GOAL_REMINDER_COOLDOWN_HOURS)),
    },
    '_id fcmToken',
    async (users) => {
      const messages = users.map((u) => ({
        to: u.fcmToken,
        title: 'Set a posture goal 🎯',
        body: "You haven't set a neck-angle goal yet — pick a target and we'll help you track it.",
        data: { type: 'goal_reminder' },
      }));
      summary.due += users.length;
      summary.sent += await sendAndStamp(users, messages, 'lastGoalReminderSentAt', now, signal);
    },
    signal
  );
  return summary;
}

/**
 * Nudges users (goal on or off) who haven't logged a neck-angle check-in
 * recently. Copy differs slightly depending on whether they have an
 * active goal.
 */
export async function runCheckInReminder(now: Date = new Date(), signal?: AbortSignal): Promise<ReminderRunSummary> {
  const summary = { due: 0, sent: 0 };
  const staleCutoff = hoursBefore(now, CHECKIN_STALE_HOURS);
  await forEachCandidateChunk(
    {
      fcmToken: HAS_PUSH_TOKEN,
      allowPushNotifications: true,
      deleted: { $ne: true },
      dateRegistered: { $lt: hoursBefore(now, MIN_ACCOUNT_AGE_HOURS) },
      ...notSentSince('lastCheckInReminderSentAt', hoursBefore(now, CHECKIN_REMINDER_COOLDOWN_HOURS)),
    },
    '_id fcmToken isGoalOn',
    async (users) => {
      // One indexed query for the whole chunk: who has a reading newer than
      // the cutoff? (Was a findOne per user.)
      const checkedIn = new Set(
        (
          await NeckAngleRecordModel.distinct('appUserId', {
            appUserId: { $in: users.map((u) => String(u._id)) },
            dateTimeRecorded: { $gt: staleCutoff },
          })
        ).map(String)
      );
      const due = users.filter((u) => !checkedIn.has(String(u._id)));
      const messages = due.map((u) => ({
        to: u.fcmToken,
        title: u.isGoalOn ? "It's been a while 👋" : 'Quick neck check?',
        body: u.isGoalOn
          ? "You haven't logged a neck-angle check-in today — a quick check keeps your goal on track."
          : "It's been a while since your last neck-angle check. Open CerviTech for a 30-second check-in.",
        data: { type: 'checkin_reminder' },
      }));
      summary.due += due.length;
      summary.sent += await sendAndStamp(due, messages, 'lastCheckInReminderSentAt', now, signal);
    },
    signal
  );
  return summary;
}

/**
 * Premium/goal-progress nudge: for users with an active goal (goal-setting
 * is premium-gated client-side, so this is in practice premium users)
 * whose recent posture is trailing their target, sends a nudge naming
 * their actual numbers. Each user is cooled down independently so this
 * doesn't mean "every 2 hours per user".
 *
 * NOTE ON "BACKGROUND": there's no continuous OS-level background
 * accelerometer loop here — iOS in particular doesn't allow that for a
 * consumer app, and Android heavily restricts it too. This works off
 * samples already uploaded while the realtime screen was open (see
 * stores/dashboardStore.js's queueNeckAngleSample/flushNeckAngleQueue on
 * the frontend), which is the honest, App-Store-compliant version of
 * "background" for this kind of sensor.
 */
export async function runGoalProgressReminder(now: Date = new Date(), signal?: AbortSignal): Promise<ReminderRunSummary> {
  const summary = { due: 0, sent: 0 };
  const windowStart = new Date(now.getTime() - RECENT_WINDOW_MINUTES * 60 * 1000);
  await forEachCandidateChunk(
    {
      isGoalOn: true,
      fcmToken: HAS_PUSH_TOKEN,
      allowPushNotifications: true,
      deleted: { $ne: true },
      ...notSentSince('lastGoalReminderSentAt', hoursBefore(now, GOAL_PROGRESS_COOLDOWN_HOURS)),
    },
    '_id fcmToken goals.dateSet goals.targetedAverageNeckAngle',
    async (users) => {
      const targets = new Map<string, number>();
      for (const user of users) {
        const goals = [...(user.goals ?? [])].sort(
          (a, b) => new Date(b.dateSet).getTime() - new Date(a.dateSet).getTime()
        );
        const target = goals[0]?.targetedAverageNeckAngle;
        if (target) targets.set(String(user._id), target);
      }

      const totals = await recentAngleTotals([...targets.keys()], windowStart);
      const due: Candidate[] = [];
      const messages: PushNotificationModelDTO[] = [];
      for (const user of users) {
        const id = String(user._id);
        const target = targets.get(id);
        const recent = totals.get(id);
        if (!target || !recent || recent.count < MIN_SAMPLES_FOR_ALERT) continue;

        const avg = Math.round(recent.total / recent.count);
        if (avg >= target) continue; // already meeting the goal, nothing to nudge about

        due.push(user);
        messages.push({
          to: user.fcmToken,
          title: 'A little off target 🎯',
          body: `You're at ${avg}° right now — your goal is ${target}°. A quick chin tuck can help close the gap.`,
          data: { type: 'goal_progress', avg, target },
        });
      }
      summary.due += due.length;
      summary.sent += await sendAndStamp(due, messages, 'lastGoalReminderSentAt', now, signal);
    },
    signal
  );
  return summary;
}

/**
 * "Wake up call" for everyone, goal or no goal: if a user's recent
 * readings are trending into Poor/Very Poor territory, nudge them
 * regardless of subscription status.
 */
export async function runBadPostureAlert(now: Date = new Date(), signal?: AbortSignal): Promise<ReminderRunSummary> {
  const summary = { due: 0, sent: 0 };
  const windowStart = new Date(now.getTime() - RECENT_WINDOW_MINUTES * 60 * 1000);
  await forEachCandidateChunk(
    {
      fcmToken: HAS_PUSH_TOKEN,
      allowPushNotifications: true,
      deleted: { $ne: true },
      ...notSentSince('lastBadPostureAlertSentAt', hoursBefore(now, BAD_POSTURE_COOLDOWN_HOURS)),
    },
    '_id fcmToken',
    async (users) => {
      const totals = await recentAngleTotals(users.map((u) => String(u._id)), windowStart);
      const due: Candidate[] = [];
      const messages: PushNotificationModelDTO[] = [];
      for (const user of users) {
        const recent = totals.get(String(user._id));
        if (!recent || recent.count < MIN_SAMPLES_FOR_ALERT) continue;

        const avg = Math.round(recent.total / recent.count);
        if (avg >= BAD_POSTURE_SCORE_THRESHOLD) continue;

        due.push(user);
        messages.push({
          to: user.fcmToken,
          title: 'Neck check ⚠️',
          body: "Your posture's been slouchy the last hour — sit up, roll your shoulders back, and take a breather.",
          data: { type: 'bad_posture_alert', avg },
        });
      }
      summary.due += due.length;
      summary.sent += await sendAndStamp(due, messages, 'lastBadPostureAlertSentAt', now, signal);
    },
    signal
  );
  return summary;
}

const describe = ({ due, sent }: ReminderRunSummary) =>
  due === 0 ? 'nobody due.' : `sent ${sent}/${due}.`;

/** Daily at 10:00. */
export const startGoalReminderJob = () =>
  scheduleExclusiveJob('goalReminder', '0 10 * * *', async (_date, signal) => describe(await runGoalReminder(new Date(), signal)));

/** Daily at 17:00 (afternoon, most timezones). */
export const startCheckInReminderJob = () =>
  scheduleExclusiveJob('checkInReminder', '0 17 * * *', async (_date, signal) =>
    describe(await runCheckInReminder(new Date(), signal))
  );

/** Every 2 hours. */
export const startGoalProgressJob = () =>
  scheduleExclusiveJob('goalProgressReminder', '0 */2 * * *', async (_date, signal) =>
    describe(await runGoalProgressReminder(new Date(), signal))
  );

/** Every 2 hours, offset by 30 minutes. */
export const startBadPostureAlertJob = () =>
  scheduleExclusiveJob('badPostureAlert', '30 */2 * * *', async (_date, signal) =>
    describe(await runBadPostureAlert(new Date(), signal))
  );

export const startPushReminderJobs = () => {
  startGoalReminderJob();
  startCheckInReminderJob();
  startGoalProgressJob();
  startBadPostureAlertJob();
};
