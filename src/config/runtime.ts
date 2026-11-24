// Runtime settings shared by the HTTP server, the Docker healthcheck and tests.
// Kept free of side effects so it can be imported without loading the app.

/** Port the API listens on when PORT is unset. Must match the Dockerfile's EXPOSE. */
export const DEFAULT_PORT = 8000;

/** Frontend origin allowed outside production when FRONTEND_URL is unset (Vite dev server). */
export const DEV_FRONTEND_ORIGIN = 'http://localhost:5173';

type Env = NodeJS.ProcessEnv;

export function resolvePort(env: Env = process.env): number {
  const raw = env.PORT?.trim();
  if (!raw) return DEFAULT_PORT;

  const port = Number(raw);
  if (!/^\d+$/.test(raw) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }
  return port;
}

export function resolveTrustProxyHops(env: Env = process.env): number {
  const trustProxyHops = env.TRUST_PROXY_HOPS ?? '0';
  if (!/^(0|[1-9]\d*)$/.test(trustProxyHops) || !Number.isSafeInteger(Number(trustProxyHops))) {
    throw new Error('TRUST_PROXY_HOPS must be a non-negative integer.');
  }
  return Number(trustProxyHops);
}

/**
 * The single browser origin allowed to make credentialed cross-origin calls.
 *
 * - FRONTEND_URL set: its origin (scheme + host + port). Invalid values fail startup.
 * - FRONTEND_URL unset outside production: the local Vite dev server.
 * - FRONTEND_URL unset in production: `false`, i.e. no cross-origin browser access.
 *   We never fall back to localhost or `*` in production.
 *
 * Requests without an Origin header (mobile app, server-to-server) are unaffected.
 */
export function resolveCorsOrigin(env: Env = process.env): string | false {
  const raw = env.FRONTEND_URL?.trim();
  if (!raw) {
    return env.NODE_ENV === 'production' ? false : DEV_FRONTEND_ORIGIN;
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('FRONTEND_URL must be an absolute http(s) URL, e.g. https://app.example.com.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('FRONTEND_URL must be an absolute http(s) URL, e.g. https://app.example.com.');
  }
  return url.origin;
}

// Error messages name the variable but never include its value. They also avoid
// "secret: <x>" / "token: <x>" shapes, which log redaction masks (that would hide the name).

/** Signing secrets the API cannot start without. Each must be set to a non-blank value. */
export const REQUIRED_SIGNING_SECRETS = [
  'APP_USER_JWT_SECRET',
  'BACKOFFICE_JWT_SECRET',
  'GENERAL_TOKEN_SECRET',
] as const;

export type SigningSecretName = (typeof REQUIRED_SIGNING_SECRETS)[number];

/** Startup configuration problems. `problems` lists each one; values are never included. */
export class ConfigurationError extends Error {
  constructor(readonly problems: string[]) {
    super(`Invalid startup configuration. ${problems.join(' ')}`);
    this.name = 'ConfigurationError';
  }
}

/** Complete MongoDB connection string. Required: there is no localhost fallback. */
export function resolveMongoUri(env: Env = process.env): string {
  const uri = env.MONGODB_URI?.trim();
  if (!uri) {
    throw new Error('MONGODB_URI is required and must not be blank.');
  }
  if (!/^mongodb(\+srv)?:\/\//.test(uri)) {
    throw new Error('MONGODB_URI must be a MongoDB connection string starting with mongodb:// or mongodb+srv://.');
  }
  return uri;
}

/**
 * Returns a signing secret exactly as configured (not trimmed, so existing
 * tokens keep verifying). Throws, naming the variable, if it is unset or blank.
 */
export function readSigningSecret(name: SigningSecretName, env: Env = process.env): string {
  const value = env[name];
  if (!value?.trim()) {
    throw new Error(`${name} is required and must not be blank.`);
  }
  return value;
}

export interface StartupConfig {
  port: number;
  mongoUri: string;
  trustProxyHops: number;
  corsOrigin: string | false;
}

/**
 * Validates every setting the API needs before it opens a connection or serves
 * a request. Collects all problems so one failed start reports all of them.
 */
export function validateStartupConfig(env: Env = process.env): StartupConfig {
  const problems: string[] = [];
  const check = <T>(resolve: () => T): T | undefined => {
    try {
      return resolve();
    } catch (error) {
      problems.push(error instanceof Error ? error.message : String(error));
      return undefined;
    }
  };

  const port = check(() => resolvePort(env));
  const mongoUri = check(() => resolveMongoUri(env));
  const trustProxyHops = check(() => resolveTrustProxyHops(env));
  const corsOrigin = check(() => resolveCorsOrigin(env));
  for (const name of REQUIRED_SIGNING_SECRETS) check(() => readSigningSecret(name, env));

  if (problems.length > 0) throw new ConfigurationError(problems);
  return { port: port!, mongoUri: mongoUri!, trustProxyHops: trustProxyHops!, corsOrigin: corsOrigin! };
}
