import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  constructed: [] as string[],
  beginSend: vi.fn(),
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('@azure/communication-email', () => ({
  EmailClient: class {
    beginSend = h.beginSend;
    constructor(connectionString: string) {
      h.constructed.push(connectionString);
      // Mirrors the real SDK, whose message echoes the connection string.
      if (connectionString.startsWith('bad')) throw new Error(`Invalid connection string ${connectionString}`);
    }
  },
}));
// Stop a developer's local .env from re-populating the variables under test.
vi.mock('dotenv', () => ({ default: { config: vi.fn() }, config: vi.fn() }));
vi.mock('../../src/utils/logger', () => ({ logger: h.logger }));

const VALID = 'endpoint=https://example.invalid/;accesskey=dGVzdA==';
const MALFORMED = 'bad-accesskey=SUPER_SECRET_KEY';

async function loadEmailUtils() {
  vi.resetModules();
  return import('../../src/utils/EmailService/emailutils');
}

beforeEach(() => {
  h.constructed.length = 0;
  vi.clearAllMocks();
  h.beginSend.mockResolvedValue({ pollUntilDone: async () => ({ status: 'Succeeded' }) });
  vi.stubEnv('ACS_CONNECTION_STRING', undefined);
  vi.stubEnv('SENDER_EMAIL', undefined);
});

afterEach(() => vi.unstubAllEnvs());

describe('EmailUtils lazy ACS client', () => {
  it('imports without ACS_CONNECTION_STRING and constructs no client', async () => {
    const { EmailUtils } = await loadEmailUtils();
    expect(EmailUtils).toBeDefined();
    expect(h.constructed).toEqual([]);
  });

  it('rejects sends with an actionable configuration error when unset', async () => {
    vi.stubEnv('SENDER_EMAIL', 'noreply@example.com');
    const { EmailUtils, EmailConfigurationError } = await loadEmailUtils();

    const error = await EmailUtils.sendSignupEmail('user@example.com', 'user').catch((e) => e);
    expect(error).toBeInstanceOf(EmailConfigurationError);
    expect(error.message).toBe('Email delivery is not configured: ACS_CONNECTION_STRING is not set.');
    expect(h.constructed).toEqual([]);
    expect(h.beginSend).not.toHaveBeenCalled();
    expect(h.logger.error).toHaveBeenCalledWith('Email delivery failed', error);
  });

  it('rejects when SENDER_EMAIL is unset', async () => {
    vi.stubEnv('ACS_CONNECTION_STRING', VALID);
    const { EmailUtils, EmailConfigurationError } = await loadEmailUtils();

    const error = await EmailUtils.sendReminderEmail('user@example.com', 'user').catch((e) => e);
    expect(error).toBeInstanceOf(EmailConfigurationError);
    expect(error.message).toBe('Email delivery is not configured: SENDER_EMAIL is not set.');
    expect(h.beginSend).not.toHaveBeenCalled();
  });

  it('reports a malformed connection string without exposing it', async () => {
    vi.stubEnv('ACS_CONNECTION_STRING', MALFORMED);
    vi.stubEnv('SENDER_EMAIL', 'noreply@example.com');
    const { EmailUtils, EmailConfigurationError } = await loadEmailUtils();

    const error = await EmailUtils.sendPasswordResetOtpEmail('user@example.com', 'user', '123456').catch((e) => e);
    expect(error).toBeInstanceOf(EmailConfigurationError);
    expect(error.message).toMatch(/not a valid Azure Communication Services connection string/);
    expect(String(error.message) + String(error.stack)).not.toContain('SUPER_SECRET_KEY');
    expect(JSON.stringify(h.logger.error.mock.calls)).not.toContain('SUPER_SECRET_KEY');
  });

  it('builds the client once from valid configuration and reuses it', async () => {
    vi.stubEnv('ACS_CONNECTION_STRING', ` ${VALID} `);
    vi.stubEnv('SENDER_EMAIL', 'noreply@example.com');
    const { EmailUtils } = await loadEmailUtils();

    await EmailUtils.sendSignupEmail('a@example.com', 'a');
    await EmailUtils.sendAccountDeletionConfirmation('b@example.com', 'b');

    expect(h.constructed).toEqual([VALID]);
    expect(h.beginSend).toHaveBeenCalledTimes(2);
    expect(h.beginSend).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        senderAddress: 'noreply@example.com',
        recipients: { to: [{ address: 'a@example.com' }] },
        content: expect.objectContaining({ subject: 'Welcome to CerviTech!' }),
      })
    );
  });

  it('still surfaces delivery failures to callers', async () => {
    vi.stubEnv('ACS_CONNECTION_STRING', VALID);
    vi.stubEnv('SENDER_EMAIL', 'noreply@example.com');
    h.beginSend.mockRejectedValueOnce(new Error('ACS unavailable'));
    const { EmailUtils } = await loadEmailUtils();

    await expect(EmailUtils.sendSignupEmail('a@example.com', 'a')).rejects.toThrow('ACS unavailable');
  });
});
