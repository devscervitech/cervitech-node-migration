/**
 * Map legacy accessLevel values to ADMIN or OPERATOR and initialize the
 * active-admin invariant count. Dry-run by default; pass --apply to write.
 * Stop the API while applying so requests cannot race this one-time migration.
 *
 * BACKOFFICE_ACCESS_LEVEL_MAP is JSON, for example:
 *   {"administrator":"ADMIN","staff":"OPERATOR"}
 */

import mongoose from 'mongoose';
import BackofficeUser from '../src/models/BackOfficeUser';
import BackofficeSecurityState, {
  ACTIVE_BACKOFFICE_ADMIN_STATE_ID,
} from '../src/models/BackofficeSecurityState';
import {
  BACKOFFICE_ACCESS_LEVEL,
  BACKOFFICE_ACCESS_LEVELS,
  BackofficeAccessLevel,
} from '../src/enums/backofficeAccessLevel';

type AccessLevelGroup = { _id: unknown; count: number };

function parseMapping(): Record<string, BackofficeAccessLevel> {
  let configured: Record<string, unknown> = {};
  const raw = process.env.BACKOFFICE_ACCESS_LEVEL_MAP;
  if (raw) {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error('BACKOFFICE_ACCESS_LEVEL_MAP must be a JSON object');
    }
    configured = parsed as Record<string, unknown>;
  }

  const mapping: Record<string, BackofficeAccessLevel> = Object.create(null);
  for (const [source, target] of Object.entries(configured)) {
    if (!BACKOFFICE_ACCESS_LEVELS.includes(target as BackofficeAccessLevel)) {
      throw new Error(`Invalid target level for legacy value ${source}`);
    }
    mapping[source] = target as BackofficeAccessLevel;
  }
  for (const level of BACKOFFICE_ACCESS_LEVELS) mapping[level] = level;
  return mapping;
}

async function main() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('MONGODB_URI is not set. Load the intended environment before running this migration.');
    process.exitCode = 1;
    return;
  }

  const apply = process.argv.includes('--apply');

  try {
    const mapping = parseMapping();
    await mongoose.connect(mongoUri);

    const groups = await BackofficeUser.aggregate<AccessLevelGroup>([
      { $group: { _id: '$accessLevel', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    const plan = groups.map(({ _id, count }) => {
      const key = _id === null || _id === undefined ? '<missing>' : String(_id);
      return {
        key,
        oldValue: _id,
        count,
        target: mapping[key],
        filter: _id === null || _id === undefined ? { accessLevel: null } : { accessLevel: _id },
      };
    });
    const unmapped = plan.filter(({ target }) => target === undefined);

    console.log(`Mode: ${apply ? 'APPLY' : 'DRY RUN'}`);
    console.log('Access-level migration plan (counts only):');
    for (const row of plan) {
      console.log(`  ${row.key}: ${row.count} account(s) -> ${row.target ?? 'UNMAPPED'}`);
    }

    if (unmapped.length > 0) {
      console.error('Map every legacy value in BACKOFFICE_ACCESS_LEVEL_MAP before applying.');
      process.exitCode = 1;
      return;
    }

    if (!apply) {
      console.log('Dry run only. Stop the API and pass --apply after reviewing the mapping.');
      return;
    }

    for (const row of plan) {
      if (row.key === row.target) continue;
      await BackofficeUser.updateMany(
        row.filter,
        { $set: { accessLevel: row.target } },
        { runValidators: true }
      );
    }

    const activeAdminCount = await BackofficeUser.countDocuments({
      accessLevel: BACKOFFICE_ACCESS_LEVEL.ADMIN,
      readOnly: false,
    });
    await BackofficeSecurityState.updateOne(
      { _id: ACTIVE_BACKOFFICE_ADMIN_STATE_ID },
      { $set: { activeAdminCount, adminMutationLocked: false } },
      { upsert: true }
    );
    console.log(`Migration complete. Active administrator count: ${activeAdminCount}.`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch(() => {
  console.error('Back-office access-level migration failed. Check database connectivity and mapping.');
  process.exitCode = 1;
});
