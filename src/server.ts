// Load environment variables before any module reads them.
import 'dotenv/config';
import http from 'node:http';
import mongoose from 'mongoose';
import { logger } from './utils/logger';
import { createApp } from './app';
import { validateStartupConfig } from './config/runtime';
import { startMonthlyReminderJob, runMonthlyReminderCatchUp } from './jobs/monthlyReminder.job';
import { startSubscriptionSyncJob } from './jobs/subscriptionSync.job';
import { startPushReminderJobs } from './jobs/pushReminders.job';
import { startGoalCycleSummaryJob } from './jobs/goalCycleSummary.job';
import { startPushReceiptsJob } from './jobs/pushReceipts.job';
import AuthRateLimitBucket from './models/AuthRateLimitBucket';

/** Docker's default stop grace period is 10s; exit before SIGKILL arrives. */
const SHUTDOWN_TIMEOUT_MS = 8000;

function startBackgroundJobs(): void {
    startMonthlyReminderJob();
    startSubscriptionSyncJob();
    startPushReminderJobs();
    startGoalCycleSummaryJob();
    startPushReceiptsJob();
    if (process.env.REMINDER_JOB_ENABLED !== 'false') {
      runMonthlyReminderCatchUp()
        .then((result) => {
          if (result.outcome === 'ran') {
            logger.info(
              `Monthly reminder catch-up on boot: ${result.sent} sent, ${result.failed} failed, ${result.totalFound} found.`
            );
          } else {
            logger.info('Monthly reminder catch-up on boot: no run required.');
          }
        })
        .catch((err) =>
          logger.error('Monthly reminder catch-up on boot failed', {
            error: err instanceof Error ? err.message : String(err),
          })
        );
    }
}

function listen(server: http.Server, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, () => {
      server.off('error', reject);
      resolve();
    });
  });
}

/**
 * Starts the API in dependency order. Nothing is served and no job runs until
 * MongoDB is connected and its startup indexes exist; any failure rejects.
 */
export async function startServer(): Promise<http.Server> {
  // Validate all required configuration (port, MongoDB URI, signing secrets,
  // proxy and CORS settings) before opening any connection. Importing the app's
  // modules reads no required values, so failures land here and reach
  // handleStartupFailure instead of escaping as an import-time exception.
  const { port, mongoUri } = validateStartupConfig();
  const app = createApp();

  await mongoose.connect(mongoUri, {
    dbName: 'cervitechdb', // 👈 force your app to use "cervitech" database
  });
  await AuthRateLimitBucket.init();
  logger.info('MongoDB connected');

  const server = http.createServer(app);
  await listen(server, port);
  logger.info(`Server running on port ${port}`);

  startBackgroundJobs();
  return server;
}

/**
 * Single exit path for startup failures. Sets a non-zero exit code and lets
 * the process drain (so the error log reaches stdout), with a hard exit as a
 * backstop in case a stray handle would keep a half-started process alive.
 */
export async function handleStartupFailure(error: unknown): Promise<void> {
  logger.error('Server startup failed; exiting', error);
  process.exitCode = 1;
  setTimeout(() => process.exit(1), 1000).unref();
  try {
    await mongoose.disconnect();
  } catch {
    // Best effort: we are exiting regardless.
  }
}

export function registerShutdownHandlers(server: http.Server): void {
  let shuttingDown = false;

  const shutdown = (signal: NodeJS.Signals) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`${signal} received; shutting down`);
    setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT_MS).unref();

    server.close(() => {
      mongoose
        .disconnect()
        .catch((err) => logger.error('MongoDB disconnect during shutdown failed', err))
        // Cron schedules keep the event loop alive, so exit explicitly.
        .finally(() => process.exit(0));
    });
  };

  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}

if (require.main === module) {
  startServer().then(registerShutdownHandlers, handleStartupFailure);
}
