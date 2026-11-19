// src/utils/compat.util.ts
export function coalesce<T = any>(...vals: any[]): T | undefined {
  for (const v of vals) {
    if (v !== undefined && v !== null) return v;
  }
  return undefined;
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