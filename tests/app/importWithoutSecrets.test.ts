import { afterAll, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';

// Runs in its own test file so the application modules are evaluated for the
// first time with the signing secrets blank. Blank rather than unset, so a
// module's dotenv.config() cannot fill them from a local .env file.
const SECRETS = ['APP_USER_JWT_SECRET', 'BACKOFFICE_JWT_SECRET', 'GENERAL_TOKEN_SECRET'] as const;
const original = vi.hoisted(() => {
  const names = ['APP_USER_JWT_SECRET', 'BACKOFFICE_JWT_SECRET', 'GENERAL_TOKEN_SECRET'];
  const saved = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  for (const name of names) process.env[name] = '';
  return saved;
});

afterAll(() => {
  for (const [name, value] of Object.entries(original)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

it('imports the server, app, routes and token utilities without throwing; startServer reports the secrets', async () => {
  // server.ts statically imports createApp -> routes -> controllers -> token.util.
  const server = await import('../../src/server');
  const { createApp } = await import('../../src/app');
  await import('../../src/utils/token.util');
  expect(() => createApp()).not.toThrow();

  vi.stubEnv('MONGODB_URI', 'mongodb://127.0.0.1:27017/cervitech-test');
  const connect = vi.spyOn(mongoose, 'connect');

  // The failure surfaces from startServer(), where handleStartupFailure receives it.
  await expect(server.startServer()).rejects.toMatchObject({
    name: 'ConfigurationError',
    problems: SECRETS.map((name) => `${name} is required and must not be blank.`),
  });
  expect(connect).not.toHaveBeenCalled();
  vi.unstubAllEnvs();
}, 60_000); // first evaluation of the whole app graph is slow
