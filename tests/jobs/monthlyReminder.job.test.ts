import { describe, it, expect, vi, beforeEach } from 'vitest';

const jobRunCreate = vi.fn();
const jobRunFindOne = vi.fn();
const jobRunUpdateOne = vi.fn();
const appUserFind = vi.fn();
const sendReminderEmail = vi.fn();

vi.mock('../../src/models/JobRun', () => ({
  default: {
    create: (...args: unknown[]) => jobRunCreate(...args),
    findOne: (...args: unknown[]) => jobRunFindOne(...args),
    updateOne: (...args: unknown[]) => jobRunUpdateOne(...args),
  },
}));

vi.mock('../../src/models/AppUser', () => ({
  default: { find: (...args: unknown[]) => appUserFind(...args) },
}));

vi.mock('../../src/utils/EmailService/emailutils', () => ({
  EmailUtils: { sendReminderEmail: (...args: unknown[]) => sendReminderEmail(...args) },
}));

import { runMonthlyReminder, runMonthlyReminderCatchUp, monthKeyOf } from '../../src/jobs/monthlyReminder.job';

const NOW = new Date('2026-08-14T09:00:00Z');

const inactiveUser = (email: string, username: string) => ({ email, username });

beforeEach(() => {
  vi.clearAllMocks();
  jobRunUpdateOne.mockResolvedValue(undefined);
});

describe('monthKeyOf', () => {
  it('derives a UTC-based YYYY-MM key', () => {
    expect(monthKeyOf(new Date('2026-08-14T09:00:00Z'))).toBe('2026-08');
    expect(monthKeyOf(new Date('2026-12-31T23:59:59Z'))).toBe('2026-12');
    expect(monthKeyOf(new Date('2026-01-01T00:00:00Z'))).toBe('2026-01');
  });
});

describe('runMonthlyReminder', () => {
  it('emails every inactive user and finalizes the run as completed', async () => {
    jobRunCreate.mockResolvedValue({ _id: 'run-1', status: 'running', startedAt: NOW });
    appUserFind.mockResolvedValue([
      inactiveUser('a@x.com', 'alice'),
      inactiveUser('b@x.com', 'bob'),
    ]);
    sendReminderEmail.mockResolvedValue({});

    const result = await runMonthlyReminder(NOW);

    expect(result).toEqual({ outcome: 'ran', totalFound: 2, sent: 2, failed: 0 });
    expect(jobRunCreate).toHaveBeenCalledWith({
      job: 'monthlyReminder',
      monthKey: '2026-08',
      status: 'running',
      startedAt: NOW,
    });
    expect(appUserFind).toHaveBeenCalledWith({
      email: { $exists: true, $ne: null },
      $or: [
        { lastLoginDateTime: { $lt: expect.any(Date) } },
        { lastLoginDateTime: { $exists: false } },
      ],
    });
    expect(sendReminderEmail).toHaveBeenCalledTimes(2);
    expect(sendReminderEmail).toHaveBeenCalledWith('a@x.com', 'alice');
    expect(sendReminderEmail).toHaveBeenCalledWith('b@x.com', 'bob');
    expect(jobRunUpdateOne).toHaveBeenCalledWith(
      { _id: 'run-1' },
      expect.objectContaining({
        $set: expect.objectContaining({
          status: 'completed',
          totalFound: 2,
          sent: 2,
          failed: 0,
        }),
      })
    );
  });

  it('skips the month when the ledger already has a run record (duplicate key)', async () => {
    jobRunCreate.mockRejectedValue({ code: 11000 });
    appUserFind.mockResolvedValue([inactiveUser('a@x.com', 'alice')]);

    const result = await runMonthlyReminder(NOW);

    expect(result).toEqual({ outcome: 'skipped', totalFound: 0, sent: 0, failed: 0 });
    expect(appUserFind).not.toHaveBeenCalled();
    expect(sendReminderEmail).not.toHaveBeenCalled();
    expect(jobRunUpdateOne).not.toHaveBeenCalled();
  });

  it('counts a failed send without aborting the rest of the batch', async () => {
    jobRunCreate.mockResolvedValue({ _id: 'run-1', status: 'running', startedAt: NOW });
    appUserFind.mockResolvedValue([
      inactiveUser('a@x.com', 'alice'),
      inactiveUser('b@x.com', 'bob'),
    ]);
    sendReminderEmail.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('SMTP down'));

    const result = await runMonthlyReminder(NOW);

    expect(result).toEqual({ outcome: 'ran', totalFound: 2, sent: 1, failed: 1 });
    expect(sendReminderEmail).toHaveBeenCalledTimes(2);
    expect(jobRunUpdateOne).toHaveBeenCalledWith(
      { _id: 'run-1' },
      expect.objectContaining({
        $set: expect.objectContaining({ status: 'completed', sent: 1, failed: 1 }),
      })
    );
  });

  it('marks the run as failed and rethrows when the user query fails', async () => {
    jobRunCreate.mockResolvedValue({ _id: 'run-1', status: 'running', startedAt: NOW });
    appUserFind.mockRejectedValue(new Error('db down'));

    await expect(runMonthlyReminder(NOW)).rejects.toThrow('db down');

    expect(sendReminderEmail).not.toHaveBeenCalled();
    expect(jobRunUpdateOne).toHaveBeenCalledWith(
      { _id: 'run-1' },
      expect.objectContaining({
        $set: expect.objectContaining({ status: 'failed', errorSummary: 'db down' }),
      })
    );
  });
});

describe('runMonthlyReminderCatchUp', () => {
  const twoHoursAgo = () => new Date(NOW.getTime() - 2 * 60 * 60 * 1000);
  const freshRunning = () => ({ _id: 'run-1', status: 'running', startedAt: NOW });
  const staleRunning = () => ({ _id: 'run-1', status: 'running', startedAt: twoHoursAgo() });

  it('runs the month when the ledger has no record yet', async () => {
    jobRunFindOne.mockResolvedValue(null);
    jobRunCreate.mockResolvedValue({ _id: 'run-1', status: 'running', startedAt: NOW });
    appUserFind.mockResolvedValue([]);

    const result = await runMonthlyReminderCatchUp(NOW);

    expect(result).toEqual({ outcome: 'ran', totalFound: 0, sent: 0, failed: 0 });
    expect(jobRunCreate).toHaveBeenCalled();
  });

  it('skips when the month is already completed', async () => {
    jobRunFindOne.mockResolvedValue({ _id: 'run-1', status: 'completed', startedAt: twoHoursAgo() });

    const result = await runMonthlyReminderCatchUp(NOW);

    expect(result).toEqual({ outcome: 'skipped', totalFound: 0, sent: 0, failed: 0 });
    expect(jobRunCreate).not.toHaveBeenCalled();
    expect(appUserFind).not.toHaveBeenCalled();
  });

  it('skips when another instance is currently running the month', async () => {
    jobRunFindOne.mockResolvedValue(freshRunning());

    const result = await runMonthlyReminderCatchUp(NOW);

    expect(result).toEqual({ outcome: 'skipped', totalFound: 0, sent: 0, failed: 0 });
    expect(appUserFind).not.toHaveBeenCalled();
  });

  it('retries an abandoned running record through the dedupe-safe create path', async () => {
    jobRunFindOne.mockResolvedValue(staleRunning());
    jobRunCreate.mockResolvedValue({ _id: 'run-2', status: 'running', startedAt: NOW });
    appUserFind.mockResolvedValue([inactiveUser('a@x.com', 'alice')]);

    const result = await runMonthlyReminderCatchUp(NOW);

    expect(result).toEqual({ outcome: 'ran', totalFound: 1, sent: 1, failed: 0 });
    expect(jobRunUpdateOne).toHaveBeenCalledWith(
      { _id: 'run-1' },
      expect.objectContaining({
        $set: expect.objectContaining({ status: 'failed', errorSummary: 'abandoned; retried' }),
      })
    );
    expect(jobRunCreate).toHaveBeenCalledWith(
      expect.objectContaining({ job: 'monthlyReminder', monthKey: '2026-08', status: 'running' })
    );
    expect(jobRunUpdateOne).toHaveBeenLastCalledWith(
      { _id: 'run-2' },
      expect.objectContaining({
        $set: expect.objectContaining({ status: 'completed', totalFound: 1, sent: 1, failed: 0 }),
      })
    );
  });
});