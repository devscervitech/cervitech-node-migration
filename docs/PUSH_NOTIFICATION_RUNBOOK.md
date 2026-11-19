# Push Notification Runbook

Operational guide for the CerviTech push-notification system: scheduled dispatch
slots, operational constraints, env configuration, and recovery pointers.

The system delivers pushes through **Expo's push API** (`exp.host/--/api/v2/push/send`,
including receipt polling against `.../push/getReceipts`). Device tokens are Expo push
tokens (`ExponentPushToken[...]`). Every push accepted or rejected by Expo is recorded in
the `PushNotificationLog` audit collection; polling job confirms actual device delivery.

## Scheduled jobs

All jobs are started in `src/server.ts` after MongoDB connects, using `node-cron`.
**All times are UTC.** When a job slot is skipped (process down, deploy), runs are not
backfilled — the next slot simply applies the "due" rules below.

| Job                                                          | Cron (UTC)                        | What it does                                                                                                                                                                                                                                                                     | What it sends                                                                 |
| ------------------------------------------------------------ | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Goal-cycle summary (`src/jobs/goalCycleSummary.job.ts`)      | `0 8 * * *`                       | Concludes goal cycles whose calendar period has elapsed and records the compliance scorecard (`GoalCycleCompletionReport`). Idempotent per goal via the `nextCycleEndsAt` marker: a goal is never concluded twice.                                                               | "Your goal report" push to the goal owner.                                    |
| Goal-not-set reminder (`src/jobs/pushReminders.job.ts`)      | `0 10 * * *`                      | Users with `isGoalOn: false`, valid token, push enabled, not deleted, account older than 24 h (`MIN_ACCOUNT_AGE_HOURS`), who haven't been nudged in 72 h (`GOAL_REMINDER_COOLDOWN_HOURS`).                                                                                       | "Set a posture goal 🎯" nudge (`data.type: goal_reminder`).                   |
| Check-in reminder (`src/jobs/pushReminders.job.ts`)          | `0 17 * * *`                      | Users (goal on or off) with no neck-angle record in the last 24 h (`CHECKIN_STALE_HOURS`), last check-in reminder older than 24 h (`CHECKIN_REMINDER_COOLDOWN_HOURS`). Copy differs by goal state.                                                                               | "Quick neck check?" / "It's been a while 👋" (`data.type: checkin_reminder`). |
| Receipt polling (`src/jobs/pushReceipts.job.ts`)             | `*/15 * * * *`                    | Asks Expo for delivery receipts for every `pending` `PushNotificationLog` entry older than 15 min (`RECEIPT_MIN_AGE_MS` — Expo receipts are available ~15 min after send), chunked to Expo's 1000-id lookup limit. Marks entries delivered/failed, clears `DeviceNotRegistered` tokens, alerts on any confirmed failure. Entries past Expo's 24 h receipt window (`RECEIPT_EXPIRY_MS` — Expo discards receipts 24 h after send) are closed as `failed` with `receipt window expired` instead of being polled forever, and are counted in the failure alert. | No user-facing push; escalates failures (see env keys).                       |
| Legacy per-user count reset (`src/services/JobScheduler.ts`) | `0 8 * * *` (per user, at signup) | Resets `notificationCount` to 0. Scheduled per user, not server-wide. **Not part of the notification gate.**                                                                                                                                                                     | None.                                                                         |

Schedule ordering matters: the 08:00 goal report lands before the 10:00 reminder, so a
user who just got their report isn't nudged into a new goal cycle in the same morning.

## Single-instance requirement

Scheduled jobs **must run on exactly one server instance at a time** (no duplicated
processes, no overlapping deploys, one task runner node).

Why: delivery rules are implemented as per-user/per-goal timestamp markers
(`lastGoalReminderSentAt`, `lastCheckInReminderSentAt`, `nextCycleEndsAt`) that are
written **after** the batch send. Two instances can both evaluate a user as "due" before
either writes the marker, and double-send the same push. Receipt polling double-processes
identical ticket ids. Only the goal-cycle summary is truly idempotent (per-goal marker),
and it is the exception, not the rule.

## Timezone handling (explicitly deferred)

- All dispatch slots are fixed **UTC** times; users are not bucketed by their own
  timezone (deferred: per-user timezone targeting for reminders).
- Goal cycle windows are computed as UTC calendar-day/week boundaries via `Date.UTC`
  in `src/services/goalCycle.ts`. Do not assume local-time behavior when on-call during
  mid-cycle hours; check `nextCycleEndsAt` on the goal, not wall-clock time, when
  diagnosing a missing "goal report".
- The reminder jobs' `hoursAgo()` windows are simple rolling windows, not calendar days.

## Client-side disposition of "Time for your neck exercises"

This exact message is **not produced by this backend** — it is copy owned by the mobile
client. The backend's closest message is the 17:00 check-in reminder ("Quick neck
check?" / "It's been a while 👋", `data.type: checkin_reminder`), and the client is
expected to deep-link that push into the neck-check screen. If a user reports seeing the
legacy message without a symptom, verify the client-side copy, not this server.

## Environment keys

| Key                                                           | Used by                                                                                                 | Default / fallback                                                                                                                                                                          |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PUSH_ALERT_SLACK_WEBHOOK_URL`                                | `src/services/pushAlert.service.ts` (`notifyPushFailure`)                                               | Unset: failures are **only written to the error log** — no Slack alert is sent. Set it to an incoming-webhook URL to get alerts for confirmed delivery failures. Changes require a restart. |
| `ENV_NUMBER_OF_RECORD_POST_BEFORE_SENDING_AVERAGE_NECK_ANGLE` | `src/services/appUserServices/neckAngle.service.ts` (`numberOfRecordPostBeforeSendingAverageNeckAngle`) | Controls how many most-recent records the average-angle push uses. Default: `5`.                                                                                                            |
| `ENV_FCM_API_URL`                                             | `src/utils/applicationConstants.ts`                                                                     | **Legacy / unused by the push path.** The driver posts to hardcoded Expo endpoints (Google's legacy FCM endpoint was shut down in June 2024). Defaults to `''`.                             |
| `ENV_FCM_SERVER_KEY`                                          | `src/utils/applicationConstants.ts`                                                                     | **Legacy / unused by the push path.** Defaults to `''`.                                                                                                                                     |
| `ENV_DEFAULT_PROMPT`                                          | `src/utils/applicationConstants.ts`                                                                     | **Unused by `NeckAngleService`** — the prompt gate currently hardcodes its default of 5. Defaults to `''`.                                                                                  |

## Operating pointers

- **Health:** `GET /api/v1/health/push` (no auth) returns `total` / `delivered` /
  `pending` / `failed` counts from `PushNotificationLog` plus the most recent confirmed
  failures. Token values are excluded.
- **Audit lifecycle:** a push is written to `PushNotificationLog` as `pending` (with the
  Expo ticket id) when Expo accepts it, or `failed` immediately on a send-time error
  (network error, rate limit) — a request that fails outright writes a `failed` entry per
  message in that chunk and raises **one aggregated alert per send batch** (never a retry,
  since the chunk may have been partially accepted). The every-15-min receipts job confirms
  `pending` → `delivered`/`failed` once Expo has a receipt (~15 min), looking up at most
  1000 ticket ids per Expo request. Entries past Expo's 24 h receipt window are closed as
  `failed` (`receipt window expired`) and counted in the failure alert. Entries that never
  update are expected while Expo is silent.
- **Recovery — stuck pending entries:** if `pending` entries never resolve, check Expo
  service status (the receipts job's `getReceipts` swallows HTTP errors and returns `{}`,
  which leaves entries pending — verify receipt polling log lines before assuming data
  is corrupt).
- **Recovery — missing push:** check (1) the user has `ExponentPushToken[...]` on
  `fcmToken`, (2) `allowPushNotifications` is true, (3) the job's cooldown/staleness
  window, (4) `PushNotificationLog` for the send, (5) Slack alerts for confirmed
  failures.
