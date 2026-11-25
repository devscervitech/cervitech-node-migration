import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import http from 'node:http';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import mongoose from 'mongoose';

const jobs = vi.hoisted(() => ({
  startMonthlyReminderJob: vi.fn(),
  runMonthlyReminderCatchUp: vi.fn(async () => ({ outcome: 'skipped' })),
  startSubscriptionSyncJob: vi.fn(),
  startPushReminderJobs: vi.fn(),
  startGoalCycleSummaryJob: vi.fn(),
  startPushReceiptsJob: vi.fn(),
  rateLimitInit: vi.fn(async () => undefined),
}));

vi.mock('../../src/jobs/monthlyReminder.job', () => ({
  startMonthlyReminderJob: jobs.startMonthlyReminderJob,
  runMonthlyReminderCatchUp: jobs.runMonthlyReminderCatchUp,
}));
vi.mock('../../src/jobs/subscriptionSync.job', () => ({ startSubscriptionSyncJob: jobs.startSubscriptionSyncJob }));
vi.mock('../../src/jobs/pushReminders.job', () => ({ startPushReminderJobs: jobs.startPushReminderJobs }));
vi.mock('../../src/jobs/goalCycleSummary.job', () => ({ startGoalCycleSummaryJob: jobs.startGoalCycleSummaryJob }));
vi.mock('../../src/jobs/pushReceipts.job', () => ({ startPushReceiptsJob: jobs.startPushReceiptsJob }));
vi.mock('../../src/models/AuthRateLimitBucket', () => ({ default: { init: jobs.rateLimitInit } }));

import { handleStartupFailure, startServer } from '../../src/server';
import { REQUIRED_SIGNING_SECRETS } from '../../src/config/runtime';

const jobStarters = [
  jobs.startMonthlyReminderJob,
  jobs.startSubscriptionSyncJob,
  jobs.startPushReminderJobs,
  jobs.startGoalCycleSummaryJob,
  jobs.startPushReceiptsJob,
  jobs.runMonthlyReminderCatchUp,
];

async function freePort(): Promise<number> {
  const server = net.createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as net.AddressInfo;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
}

beforeEach(async () => {
  vi.clearAllMocks();
  vi.stubEnv('PORT', String(await freePort()));
  vi.stubEnv('REMINDER_JOB_ENABLED', 'true');
  // Required at startup (no localhost fallback). mongoose.connect is mocked in these tests.
  vi.stubEnv('MONGODB_URI', 'mongodb://127.0.0.1:27017/cervitech-test');
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.useRealTimers();
  process.exitCode = undefined;
});

describe('startServer', () => {
  it('rejects without listening or starting jobs when MongoDB is unreachable', async () => {
    vi.spyOn(mongoose, 'connect').mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:27017'));
    const createServer = vi.spyOn(http, 'createServer');

    await expect(startServer()).rejects.toThrow('ECONNREFUSED');
    expect(createServer).not.toHaveBeenCalled();
    expect(jobs.rateLimitInit).not.toHaveBeenCalled();
    for (const start of jobStarters) expect(start).not.toHaveBeenCalled();
  });

  it('rejects without listening or starting jobs when startup indexes fail', async () => {
    vi.spyOn(mongoose, 'connect').mockResolvedValue(mongoose);
    jobs.rateLimitInit.mockRejectedValueOnce(new Error('index build failed'));
    const createServer = vi.spyOn(http, 'createServer');

    await expect(startServer()).rejects.toThrow('index build failed');
    expect(createServer).not.toHaveBeenCalled();
    for (const start of jobStarters) expect(start).not.toHaveBeenCalled();
  });

  it('rejects invalid PORT before connecting to MongoDB', async () => {
    vi.stubEnv('PORT', 'eighty');
    const connect = vi.spyOn(mongoose, 'connect');

    await expect(startServer()).rejects.toThrow('PORT must be an integer');
    expect(connect).not.toHaveBeenCalled();
  });

  it.each([undefined, '', '  '])(
    'rejects MONGODB_URI=%j before connecting, with no localhost fallback',
    async (value) => {
      vi.stubEnv('MONGODB_URI', value);
      const connect = vi.spyOn(mongoose, 'connect');
      const createServer = vi.spyOn(http, 'createServer');

      await expect(startServer()).rejects.toMatchObject({
        name: 'ConfigurationError',
        problems: ['MONGODB_URI is required and must not be blank.'],
      });
      expect(connect).not.toHaveBeenCalled();
      expect(createServer).not.toHaveBeenCalled();
    }
  );

  it.each(REQUIRED_SIGNING_SECRETS)('rejects a blank %s by name before connecting', async (name) => {
    vi.stubEnv(name, ' ');
    const connect = vi.spyOn(mongoose, 'connect');
    const createServer = vi.spyOn(http, 'createServer');

    await expect(startServer()).rejects.toMatchObject({
      name: 'ConfigurationError',
      problems: [`${name} is required and must not be blank.`],
    });
    expect(connect).not.toHaveBeenCalled();
    expect(createServer).not.toHaveBeenCalled();
    for (const start of jobStarters) expect(start).not.toHaveBeenCalled();
  });

  it('connects with the configured MONGODB_URI', async () => {
    const connect = vi.spyOn(mongoose, 'connect').mockResolvedValue(mongoose);
    const server = await startServer();
    try {
      expect(connect).toHaveBeenCalledWith('mongodb://127.0.0.1:27017/cervitech-test', { dbName: 'cervitechdb' });
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('listens on PORT and then starts jobs once MongoDB is ready', async () => {
    const connect = vi.spyOn(mongoose, 'connect').mockResolvedValue(mongoose);

    const server = await startServer();
    try {
      expect(connect).toHaveBeenCalledWith(expect.any(String), { dbName: 'cervitechdb' });
      expect((server.address() as net.AddressInfo).port).toBe(Number(process.env.PORT));
      const res = await fetch(`http://127.0.0.1:${process.env.PORT}/health`);
      expect(res.status).toBe(200);
      for (const start of jobStarters) expect(start).toHaveBeenCalledTimes(1);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('rejects if the port is already taken, without starting jobs', async () => {
    vi.spyOn(mongoose, 'connect').mockResolvedValue(mongoose);
    const blocker = net.createServer();
    await new Promise<void>((resolve) => blocker.listen(Number(process.env.PORT), resolve));
    try {
      await expect(startServer()).rejects.toMatchObject({ code: 'EADDRINUSE' });
      for (const start of jobStarters) expect(start).not.toHaveBeenCalled();
    } finally {
      await new Promise<void>((resolve) => blocker.close(() => resolve()));
    }
  });
});

describe('handleStartupFailure', () => {
  it('sets a non-zero exit code, disconnects, and force-exits as a backstop', async () => {
    vi.useFakeTimers();
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    const disconnect = vi.spyOn(mongoose, 'disconnect').mockResolvedValue(undefined);

    await handleStartupFailure(new Error('boom'));
    expect(process.exitCode).toBe(1);
    expect(disconnect).toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1000);
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('still exits non-zero if disconnect fails', async () => {
    vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    vi.spyOn(mongoose, 'disconnect').mockRejectedValue(new Error('not connected'));

    await expect(handleStartupFailure(new Error('boom'))).resolves.toBeUndefined();
    expect(process.exitCode).toBe(1);
  });
});

// Distinctive values: none of them may appear in the process output.
const DB_PASSWORD = 'b9-db-password-value';
// Nothing listens on the discard port, so the driver fails fast.
const UNREACHABLE_MONGODB_URI = `mongodb://b9user:${DB_PASSWORD}@127.0.0.1:9/cervitechdb?serverSelectionTimeoutMS=500`;
const SECRET_VALUES = {
  APP_USER_JWT_SECRET: 'b9-app-secret-value',
  BACKOFFICE_JWT_SECRET: 'b9-office-secret-value',
  GENERAL_TOKEN_SECRET: 'b9-general-secret-value',
};

async function runServerProcess(env: NodeJS.ProcessEnv): Promise<{ code: number | null; output: string }> {
  const tsxCli = createRequire(join(process.cwd(), 'package.json')).resolve('tsx/cli');
  const child = spawn(process.execPath, [tsxCli, 'src/server.ts'], {
    env: {
      ...process.env,
      PORT: String(await freePort()),
      REMINDER_JOB_ENABLED: 'false',
      ACS_CONNECTION_STRING: '',
      ...SECRET_VALUES,
      MONGODB_URI: UNREACHABLE_MONGODB_URI,
      ...env,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (chunk) => (output += chunk));
  child.stderr.on('data', (chunk) => (output += chunk));
  const code = await new Promise<number | null>((resolve) => child.on('exit', resolve));
  return { code, output };
}

function expectNoConfiguredValues(output: string): void {
  expect(output).not.toContain(DB_PASSWORD);
  expect(output).not.toContain(UNREACHABLE_MONGODB_URI);
  expect(output).not.toContain('b9user:');
  for (const value of Object.values(SECRET_VALUES)) expect(output).not.toContain(value);
}

describe('server entry point (real process)', () => {
  it('exits with code 1 and never listens when MongoDB is unreachable', async () => {
    const { code, output } = await runServerProcess({});

    expect(code).toBe(1);
    expect(output).toContain('Server startup failed; exiting');
    expect(output).not.toContain('Server running on port');
    expect(output).not.toContain('MongoDB connected');
    expectNoConfiguredValues(output);
  }, 120_000);

  it('exits with code 1 through the startup handler when signing secrets are blank', async () => {
    const { code, output } = await runServerProcess({ APP_USER_JWT_SECRET: '', BACKOFFICE_JWT_SECRET: ' ' });

    expect(code).toBe(1);
    // Reached handleStartupFailure, not an exception thrown while importing modules.
    expect(output).toContain('Server startup failed; exiting');
    expect(output).not.toContain('uncaughtException');
    expect(output).toContain('APP_USER_JWT_SECRET is required and must not be blank.');
    expect(output).toContain('BACKOFFICE_JWT_SECRET is required and must not be blank.');
    expect(output).not.toContain('GENERAL_TOKEN_SECRET is required');
    expect(output).not.toContain('MongoDB connected');
    expect(output).not.toContain('Server running on port');
    expectNoConfiguredValues(output);
  }, 120_000);
});
