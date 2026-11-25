import { describe, expect, it } from 'vitest';
import {
  ConfigurationError,
  DEFAULT_PORT,
  DEV_FRONTEND_ORIGIN,
  readSigningSecret,
  REQUIRED_SIGNING_SECRETS,
  resolveCorsOrigin,
  resolveMongoUri,
  resolvePort,
  resolveTrustProxyHops,
  validateStartupConfig,
} from '../../src/config/runtime';
import { redactText } from '../../src/utils/logRedaction';

const MONGO_URI = 'mongodb://app-user:mongo-password-value@db.internal:27017/cervitechdb?authSource=admin';
const validEnv = (): NodeJS.ProcessEnv => ({
  MONGODB_URI: MONGO_URI,
  APP_USER_JWT_SECRET: 'app-secret-value',
  BACKOFFICE_JWT_SECRET: 'office-secret-value',
  GENERAL_TOKEN_SECRET: 'general-secret-value',
});
const secretValues = ['app-secret-value', 'office-secret-value', 'general-secret-value'];

/** Runs `fn`, expecting it to throw, and returns the error. */
function thrown(fn: () => unknown): Error {
  try {
    fn();
  } catch (error) {
    return error as Error;
  }
  throw new Error('expected a throw');
}

describe('resolvePort', () => {
  it('defaults to the Docker port when PORT is unset or blank', () => {
    expect(DEFAULT_PORT).toBe(8000);
    expect(resolvePort({})).toBe(8000);
    expect(resolvePort({ PORT: '  ' })).toBe(8000);
  });

  it('lets PORT override the default', () => {
    expect(resolvePort({ PORT: '4000' })).toBe(4000);
    expect(resolvePort({ PORT: ' 3001 ' })).toBe(3001);
  });

  it.each(['abc', '80.5', '-1', '0', '65536', '8000x'])('rejects invalid PORT %s', (PORT) => {
    expect(() => resolvePort({ PORT })).toThrow('PORT must be an integer between 1 and 65535.');
  });
});

describe('resolveTrustProxyHops', () => {
  it('keeps the existing validation', () => {
    expect(resolveTrustProxyHops({})).toBe(0);
    expect(resolveTrustProxyHops({ TRUST_PROXY_HOPS: '2' })).toBe(2);
    for (const TRUST_PROXY_HOPS of ['-1', '01', 'true', '1.5']) {
      expect(() => resolveTrustProxyHops({ TRUST_PROXY_HOPS })).toThrow(
        'TRUST_PROXY_HOPS must be a non-negative integer.'
      );
    }
  });
});

describe('resolveCorsOrigin', () => {
  it('uses the origin of FRONTEND_URL', () => {
    expect(resolveCorsOrigin({ FRONTEND_URL: 'https://app.example.com' })).toBe('https://app.example.com');
    expect(resolveCorsOrigin({ FRONTEND_URL: 'https://app.example.com/admin/' })).toBe('https://app.example.com');
    expect(resolveCorsOrigin({ FRONTEND_URL: 'http://localhost:3000', NODE_ENV: 'production' })).toBe(
      'http://localhost:3000'
    );
  });

  it('falls back to the local dev server only outside production', () => {
    expect(resolveCorsOrigin({})).toBe(DEV_FRONTEND_ORIGIN);
    expect(resolveCorsOrigin({ NODE_ENV: 'development' })).toBe(DEV_FRONTEND_ORIGIN);
    expect(resolveCorsOrigin({ NODE_ENV: 'production' })).toBe(false);
    expect(resolveCorsOrigin({ NODE_ENV: 'production', FRONTEND_URL: ' ' })).toBe(false);
  });

  it.each(['app.example.com', '*', 'ftp://app.example.com', 'javascript:alert(1)'])(
    'rejects invalid FRONTEND_URL %s instead of broadening access',
    (FRONTEND_URL) => {
      expect(() => resolveCorsOrigin({ FRONTEND_URL })).toThrow('FRONTEND_URL must be an absolute http(s) URL');
    }
  );
});

describe('resolveMongoUri', () => {
  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['blank', '   '],
  ])('fails explicitly when MONGODB_URI is %s, with no localhost fallback', (_label, MONGODB_URI) => {
    expect(() => resolveMongoUri({ MONGODB_URI })).toThrow('MONGODB_URI is required and must not be blank.');
  });

  it.each(['localhost:27017', 'http://db.internal', 'postgres://user:pw@db/x'])(
    'rejects a non-MongoDB value without echoing it: %s',
    (MONGODB_URI) => {
      const error = thrown(() => resolveMongoUri({ MONGODB_URI }));
      expect(error.message).toContain('MONGODB_URI must be a MongoDB connection string');
      expect(error.message).not.toContain(MONGODB_URI);
    }
  );

  it('returns standard and SRV connection strings', () => {
    expect(resolveMongoUri({ MONGODB_URI: MONGO_URI })).toBe(MONGO_URI);
    expect(resolveMongoUri({ MONGODB_URI: ' mongodb+srv://u:p@cluster0.example.net/db ' })).toBe(
      'mongodb+srv://u:p@cluster0.example.net/db'
    );
  });
});

describe('readSigningSecret', () => {
  it.each(REQUIRED_SIGNING_SECRETS)('names %s when it is missing or blank', (name) => {
    for (const value of [undefined, '', '  \t ']) {
      expect(() => readSigningSecret(name, { ...validEnv(), [name]: value })).toThrow(
        `${name} is required and must not be blank.`
      );
    }
  });

  it('returns the configured value unchanged (not trimmed), so existing tokens keep verifying', () => {
    expect(readSigningSecret('APP_USER_JWT_SECRET', { APP_USER_JWT_SECRET: ' padded ' })).toBe(' padded ');
  });

  it('covers exactly the three role signing secrets', () => {
    expect([...REQUIRED_SIGNING_SECRETS]).toEqual(['APP_USER_JWT_SECRET', 'BACKOFFICE_JWT_SECRET', 'GENERAL_TOKEN_SECRET']);
  });
});

describe('validateStartupConfig', () => {
  it('passes with valid configuration and applies the existing defaults', () => {
    expect(validateStartupConfig(validEnv())).toEqual({
      port: DEFAULT_PORT,
      mongoUri: MONGO_URI,
      trustProxyHops: 0,
      corsOrigin: DEV_FRONTEND_ORIGIN,
    });
    expect(
      validateStartupConfig({
        ...validEnv(),
        NODE_ENV: 'production',
        PORT: '4000',
        TRUST_PROXY_HOPS: '1',
        FRONTEND_URL: 'https://app.example.com/x',
      })
    ).toEqual({ port: 4000, mongoUri: MONGO_URI, trustProxyHops: 1, corsOrigin: 'https://app.example.com' });
  });

  it.each(['MONGODB_URI', ...REQUIRED_SIGNING_SECRETS])('fails naming %s when only it is blank', (name) => {
    const error = thrown(() => validateStartupConfig({ ...validEnv(), [name]: ' ' }));
    expect(error).toBeInstanceOf(ConfigurationError);
    expect((error as ConfigurationError).problems).toEqual([`${name} is required and must not be blank.`]);
  });

  it('reports every problem at once, by name, without any configured value', () => {
    const error = thrown(() =>
      validateStartupConfig({ PORT: 'eighty', GENERAL_TOKEN_SECRET: 'general-secret-value' })
    ) as ConfigurationError;
    expect(error).toBeInstanceOf(ConfigurationError);
    expect(error.problems).toEqual([
      'PORT must be an integer between 1 and 65535.',
      'MONGODB_URI is required and must not be blank.',
      'APP_USER_JWT_SECRET is required and must not be blank.',
      'BACKOFFICE_JWT_SECRET is required and must not be blank.',
    ]);
    expect(error.message).not.toContain('general-secret-value');
  });

  it('keeps variable names readable after log redaction, and never includes values', () => {
    const error = thrown(() =>
      validateStartupConfig({ MONGODB_URI: MONGO_URI, GENERAL_TOKEN_SECRET: 'general-secret-value' })
    );
    const logged = redactText(error.message);
    expect(logged).toContain('APP_USER_JWT_SECRET is required');
    expect(logged).toContain('BACKOFFICE_JWT_SECRET is required');
    for (const value of [MONGO_URI, 'mongo-password-value', ...secretValues]) expect(logged).not.toContain(value);
  });
});
