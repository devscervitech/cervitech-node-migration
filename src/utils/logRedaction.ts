const sensitiveKey = /password|secret|token|email|authorization|cookie|otp|connectionstring|mongodb_uri|records|targetedAverageNeckAngle/i;

export function redactText(value: string): string {
  return value
    .replace(/\u001b\[[0-9;]*m/g, '')
    .replace(/\bBearer\s+[^\s,;]+/gi, 'Bearer [REDACTED]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[REDACTED]')
    .replace(/(?:Expo|Exponent)PushToken\[[^\]]+\]/g, '[REDACTED]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[REDACTED]')
    .replace(/((?:password|confirmPassword|token|secret|accesskey|otp)\s*[=:]\s*)[^\s,;]+/gi, '$1[REDACTED]')
    .replace(/(\/deletion-requests\/)[^\s/?]+/g, '$1[REDACTED]')
    .replace(/\?[^\s]*/g, '?[REDACTED]');
}

export function redact(value: unknown, seen = new WeakSet<object>()): unknown {
  if (typeof value === 'string') return redactText(value);
  if (!value || typeof value !== 'object') return value;
  if (seen.has(value)) return '[Circular]';
  seen.add(value);
  if (value instanceof Error) {
    return { name: value.name, message: redactText(value.message), stack: value.stack && redactText(value.stack) };
  }
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(item => redact(item, seen));
  return Object.fromEntries(Object.entries(value).map(([key, item]) =>
    [key, sensitiveKey.test(key) ? '[REDACTED]' : redact(item, seen)]));
}
