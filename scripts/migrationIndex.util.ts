export const tokenBlacklistIndexSpec = {
  key: { token: 1 },
  options: { unique: true },
} as const;

type IndexSpec = {
  key: Record<string, unknown>;
  options?: object;
};

/** Classifies an existing same-key index against the options a migration requires. */
export function classifyIndex(
  existingIndexes: readonly Record<string, any>[],
  spec: IndexSpec
): 'ok' | 'missing' | 'mismatch' {
  const sameKey = existingIndexes.find(
    (index) => JSON.stringify(index.key) === JSON.stringify(spec.key)
  );
  if (!sameKey) return 'missing';

  const optionsMatch = Object.entries(spec.options ?? {}).every(
    ([key, value]) => JSON.stringify(sameKey[key]) === JSON.stringify(value)
  );
  return optionsMatch ? 'ok' : 'mismatch';
}
