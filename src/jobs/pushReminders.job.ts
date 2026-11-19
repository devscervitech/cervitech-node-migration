import cron from 'node-cron';
import AppUser from '../models/AppUser';
import { NeckAngleRecordModel } from '../models/NeckAngleRecord';
import { PushNotificationDriver } from '../services/pushNotificationDriver';
import { PushNotificationModelDTO } from '../types/pushNotificationModel.types';
import { logger } from '../utils/logger';

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

function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

function isDue(lastSentAt: Date | undefined, cooldownHours: number): boolean {
  return !lastSentAt || lastSentAt < hoursAgo(cooldownHours);
}

/**
 * Nudges users who signed up but never turned a goal on.
 * Runs daily at 10:00 UTC.
 */
export const startGoalReminderJob = () => {
  cron.schedule('0 10 * * *', async () => {
    logger.info('Running goal-not-set reminder job...');
    try {
      const candidates = await AppUser.find({
        isGoalOn: false,
        fcmToken: { $exists: true, $ne: null },
        allowPushNotifications: true,
        deleted: { $ne: true },
        dateRegistered: { $lt: hoursAgo(MIN_ACCOUNT_AGE_HOURS) },
      });

      const due = candidates.filter((u) => isDue(u.lastGoalReminderSentAt, GOAL_REMINDER_COOLDOWN_HOURS));
      if (due.length === 0) {
        logger.info('Goal reminder job: nobody due.');
        return;
      }

      const messages: PushNotificationModelDTO[] = due.map((u) => ({
        to: u.fcmToken,
        title: 'Set a posture goal 🎯',
        body: "You haven't set a neck-angle goal yet — pick a target and we'll help you track it.",
        data: { type: 'goal_reminder' },
      }));

      const results = await PushNotificationDriver.sendBatch(messages);

      await Promise.all(
        due.map((u, i) => {
          if (!results.delivered[i]) return Promise.resolve();
          u.lastGoalReminderSentAt = new Date();
          return u.save();
        })
      );

      logger.info(`Goal reminder job: sent ${results.delivered.filter(Boolean).length}/${due.length}.`);
    } catch (err: any) {
      logger.error(`Error in goal reminder job: ${err.message}`);
    }
  });
};

/**
 * Nudges users (goal on or off) who haven't logged a neck-angle check-in
 * recently. Copy differs slightly depending on whether they have an
 * active goal. Runs daily at 17:00 UTC (afternoon, most timezones).
 */
export const startCheckInReminderJob = () => {
  cron.schedule('0 17 * * *', async () => {
    logger.info('Running check-in reminder job...');
    try {
      const candidates = await AppUser.find({
        fcmToken: { $exists: true, $ne: null },
        allowPushNotifications: true,
        deleted: { $ne: true },
        dateRegistered: { $lt: hoursAgo(MIN_ACCOUNT_AGE_HOURS) },
      });

      const staleCutoff = hoursAgo(CHECKIN_STALE_HOURS);
      const messages: PushNotificationModelDTO[] = [];
      const dueUsers: (typeof candidates)[number][] = [];

      for (const user of candidates) {
        if (!isDue(user.lastCheckInReminderSentAt, CHECKIN_REMINDER_COOLDOWN_HOURS)) continue;

        const lastRecord = await NeckAngleRecordModel.findOne({ appUserId: user._id.toString() })
          .sort({ dateTimeRecorded: -1 })
          .select('dateTimeRecorded');

        const hasCheckedInRecently = !!lastRecord && lastRecord.dateTimeRecorded > staleCutoff;
        if (hasCheckedInRecently) continue;

        dueUsers.push(user);
        messages.push({
          to: user.fcmToken,
          title: user.isGoalOn ? "It's been a while 👋" : 'Quick neck check?',
          body: user.isGoalOn
            ? "You haven't logged a neck-angle check-in today — a quick check keeps your goal on track."
            : "It's been a while since your last neck-angle check. Open CerviTech for a 30-second check-in.",
          data: { type: 'checkin_reminder' },
        });
      }

      if (messages.length === 0) {
        logger.info('Check-in reminder job: nobody due.');
        return;
      }

      const results = await PushNotificationDriver.sendBatch(messages);

      await Promise.all(
        dueUsers.map((u, i) => {
          if (!results.delivered[i]) return Promise.resolve();
          u.lastCheckInReminderSentAt = new Date();
          return u.save();
        })
      );

      logger.info(`Check-in reminder job: sent ${results.delivered.filter(Boolean).length}/${dueUsers.length}.`);
    } catch (err: any) {
      logger.error(`Error in check-in reminder job: ${err.message}`);
    }
  });
};

/**
 * Premium/goal-progress nudge: for users with an active goal (goal-setting
 * is premium-gated client-side, so this is in practice premium users)
 * whose recent posture is trailing their target, sends a nudge naming
 * their actual numbers. Runs every 2 hours; each user is still cooled
 * down independently so this doesn't mean "every 2 hours per user".
 *
 * NOTE ON "BACKGROUND": there's no continuous OS-level background
 * accelerometer loop here — iOS in particular doesn't allow that for a
 * consumer app, and Android heavily restricts it too. This works off
 * samples already uploaded while the realtime screen was open (see
 * stores/dashboardStore.js's queueNeckAngleSample/flushNeckAngleQueue on
 * the frontend), which is the honest, App-Store-compliant version of
 * "background" for this kind of sensor.
 */
export const startGoalProgressJob = () => {
  cron.schedule('0 */2 * * *', async () => {
    logger.info('Running goal-progress reminder job...');
    try {
      const candidates = await AppUser.find({
        isGoalOn: true,
        fcmToken: { $exists: true, $ne: null },
        allowPushNotifications: true,
        deleted: { $ne: true },
      });

      const windowStart = new Date(Date.now() - RECENT_WINDOW_MINUTES * 60 * 1000);
      const messages: PushNotificationModelDTO[] = [];
      const dueUsers: (typeof candidates)[number][] = [];

      for (const user of candidates) {
        if (!isDue(user.lastGoalReminderSentAt, GOAL_PROGRESS_COOLDOWN_HOURS)) continue;

        const goals = [...(user.goals ?? [])].sort(
          (a, b) => new Date(b.dateSet).getTime() - new Date(a.dateSet).getTime()
        );
        const target = goals[0]?.targetedAverageNeckAngle;
        if (!target) continue;

        const recent = await NeckAngleRecordModel.find({
          appUserId: user._id.toString(),
          dateTimeRecorded: { $gte: windowStart },
        }).select('angle');

        if (recent.length < MIN_SAMPLES_FOR_ALERT) continue;

        const avg = Math.round(recent.reduce((sum, r) => sum + r.angle, 0) / recent.length);
        if (avg >= target) continue; // already meeting the goal, nothing to nudge about

        dueUsers.push(user);
        messages.push({
          to: user.fcmToken,
          title: 'A little off target 🎯',
          body: `You're at ${avg}° right now — your goal is ${target}°. A quick chin tuck can help close the gap.`,
          data: { type: 'goal_progress', avg, target },
        });
      }

      if (messages.length === 0) {
        logger.info('Goal-progress job: nobody due.');
        return;
      }

      const results = await PushNotificationDriver.sendBatch(messages);
      await Promise.all(
        dueUsers.map((u, i) => {
          if (!results.delivered[i]) return Promise.resolve();
          u.lastGoalReminderSentAt = new Date();
          return u.save();
        })
      );
      logger.info(`Goal-progress job: sent ${results.delivered.filter(Boolean).length}/${dueUsers.length}.`);
    } catch (err: any) {
      logger.error(`Error in goal-progress job: ${err.message}`);
    }
  });
};

/**
 * "Wake up call" for everyone, goal or no goal: if a user's recent
 * readings are trending into Poor/Very Poor territory, nudge them
 * regardless of subscription status. Runs every 2 hours.
 */
export const startBadPostureAlertJob = () => {
  cron.schedule('30 */2 * * *', async () => {
    logger.info('Running bad-posture alert job...');
    try {
      const candidates = await AppUser.find({
        fcmToken: { $exists: true, $ne: null },
        allowPushNotifications: true,
        deleted: { $ne: true },
      });

      const windowStart = new Date(Date.now() - RECENT_WINDOW_MINUTES * 60 * 1000);
      const messages: PushNotificationModelDTO[] = [];
      const dueUsers: (typeof candidates)[number][] = [];

      for (const user of candidates) {
        if (!isDue(user.lastBadPostureAlertSentAt, BAD_POSTURE_COOLDOWN_HOURS)) continue;

        const recent = await NeckAngleRecordModel.find({
          appUserId: user._id.toString(),
          dateTimeRecorded: { $gte: windowStart },
        }).select('angle');

        if (recent.length < MIN_SAMPLES_FOR_ALERT) continue;

        const avg = Math.round(recent.reduce((sum, r) => sum + r.angle, 0) / recent.length);
        if (avg >= BAD_POSTURE_SCORE_THRESHOLD) continue;

        dueUsers.push(user);
        messages.push({
          to: user.fcmToken,
          title: 'Neck check ⚠️',
          body: "Your posture's been slouchy the last hour — sit up, roll your shoulders back, and take a breather.",
          data: { type: 'bad_posture_alert', avg },
        });
      }

      if (messages.length === 0) {
        logger.info('Bad-posture alert job: nobody due.');
        return;
      }

      const results = await PushNotificationDriver.sendBatch(messages);
      await Promise.all(
        dueUsers.map((u, i) => {
          if (!results.delivered[i]) return Promise.resolve();
          u.lastBadPostureAlertSentAt = new Date();
          return u.save();
        })
      );
      logger.info(`Bad-posture alert job: sent ${results.delivered.filter(Boolean).length}/${dueUsers.length}.`);
    } catch (err: any) {
      logger.error(`Error in bad-posture alert job: ${err.message}`);
    }
  });
};

export const startPushReminderJobs = () => {
  startGoalReminderJob();
  startCheckInReminderJob();
  startGoalProgressJob();
  startBadPostureAlertJob();
};