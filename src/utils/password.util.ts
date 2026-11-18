import { HashUtil } from './hash';

/** Remove all whitespace so accidental spaces never change a password. */
export function normalizePassword(password: string): string {
  return password.replace(/\s/g, '');
}

/**
 * Compare against the normalized password first. If an existing hash was
 * created before whitespace normalization, allow the exact legacy value once
 * so the caller can replace that hash with the normalized one after login.
 */
export async function verifyPasswordInput(password: string, hash: string) {
  const normalizedPassword = normalizePassword(password);
  if (!normalizedPassword) {
    return { isValid: false, normalizedPassword, needsRehash: false };
  }

  if (await HashUtil.compare(normalizedPassword, hash)) {
    return { isValid: true, normalizedPassword, needsRehash: false };
  }

  if (password !== normalizedPassword && (await HashUtil.compare(password, hash))) {
    return { isValid: true, normalizedPassword, needsRehash: true };
  }

  return { isValid: false, normalizedPassword, needsRehash: false };
}
