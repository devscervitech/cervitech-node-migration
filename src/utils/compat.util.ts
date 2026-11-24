// src/utils/compat.util.ts
export function coalesce<T = any>(...vals: any[]): T | undefined {
  for (const v of vals) {
    if (v !== undefined && v !== null) return v;
  }
  return undefined;
}

/**
 * Narrows a route param or query value to a single string, rejecting anything
 * else (arrays, nested objects, absent values) by returning undefined.
 *
 * Express 5 types `req.params[k]` as `string | string[]` and a query value as
 * `string | string[] | ParsedQs | ParsedQs[]`, because a repeated or wildcard
 * param genuinely can arrive as an array. For an identifier that is about to
 * reach a database lookup or a permission check, taking `value[0]` and
 * carrying on is how parameter-smuggling bugs happen -- a crafted request
 * gets to choose which of several values the check sees. So an array is
 * refused outright and the caller's existing `if (!id)` guard turns it into
 * the 400 it should always have been.
 */
export function singleString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function normalizeBoolean(v: any): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v === 1;
  if (typeof v === "string") {
    const s = v.toLowerCase().trim();
    return s === "true" || s === "1" || s === "yes" || s === "on";
  }
  return false;
}