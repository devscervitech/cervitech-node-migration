import { describe, expect, it } from 'vitest';
import TokenBlacklist from '../../src/models/TokenBlacklist';
import { classifyIndex, tokenBlacklistIndexSpec } from '../../scripts/migrationIndex.util';

describe('neck-angle migration index expectations', () => {
  it('requires a unique token index and retains the token blacklist TTL index', () => {
    expect(tokenBlacklistIndexSpec).toEqual({
      key: { token: 1 },
      options: { unique: true },
    });
    expect(TokenBlacklist.schema.path('expiresAt').options.expires).toBe(0);
  });

  it('reports missing, compatible, and non-unique token indexes correctly', () => {
    expect(classifyIndex([], tokenBlacklistIndexSpec)).toBe('missing');
    expect(
      classifyIndex([{ key: { token: 1 }, unique: true }], tokenBlacklistIndexSpec)
    ).toBe('ok');
    expect(
      classifyIndex([{ key: { token: 1 }, unique: false }], tokenBlacklistIndexSpec)
    ).toBe('mismatch');
    // MongoDB normally omits `unique` on non-unique indexes rather than returning false.
    expect(classifyIndex([{ key: { token: 1 } }], tokenBlacklistIndexSpec)).toBe('mismatch');
  });
});
