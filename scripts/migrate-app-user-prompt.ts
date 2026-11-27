/**
 * Backfill AppUser.prompt for records written before the `min: 1` constraint.
 *
 * Why this is needed: `prompt` used to be written as 0 at signup, which
 * silently disabled the average-neck-angle push (the gate is `prompt > 0`).
 * The fix added `default: 5, min: 1` to AppUserSchema and changed signup to
 * write 5 -- correct for new accounts, but every account created by the old
 * code still has 0 on disk. Mongoose does not validate on read, so that sat
 * there harmlessly until something called `user.save()`, which re-validates
 * every path on the document. Login does exactly that to stamp
 * lastLoginDateTime, so every pre-existing user started getting a 500 on an
 * otherwise successful login.
 *
 * This backfills those records so they satisfy the constraint and get the
 * push behaviour the fix intended. Dry-run by default; pass --apply to write.
 *
 * Usage:
 *   npx dotenv -e .env.staging -- npx tsx scripts/migrate-app-user-prompt.ts
 *   npx dotenv -e .env.staging -- npx tsx scripts/migrate-app-user-prompt.ts --apply
 *
 * Safe to re-run: the filter only matches records that are still invalid, so a
 * second run reports 0 affected and writes nothing.
 */

import mongoose from 'mongoose';
import AppUser from '../src/models/AppUser';

/** Must match `default` on AppUserSchema.prompt and the value signup writes. */
const DEFAULT_PROMPT = 5;

/**
 * MongoDB brackets comparisons by type, so `{ prompt: { $lt: 1 } }` matches
 * numbers below 1 but NOT null or a missing field. `{ prompt: null }` matches
 * both of those. Both clauses are needed to catch every invalid record.
 */
const INVALID_PROMPT_FILTER = {
  $or: [{ prompt: { $lt: 1 } }, { prompt: null }],
};

type PromptGroup = { _id: unknown; count: number };

async function main() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error(
      'MONGODB_URI is not set. Load the intended environment before running this migration.'
    );
    process.exitCode = 1;
    return;
  }

  const apply = process.argv.includes('--apply');

  try {
    await mongoose.connect(mongoUri);

    const total = await AppUser.countDocuments({});
    const affected = await AppUser.countDocuments(INVALID_PROMPT_FILTER);

    // Counts only -- no emails or usernames in the output.
    const groups = await AppUser.aggregate<PromptGroup>([
      { $match: INVALID_PROMPT_FILTER },
      { $group: { _id: '$prompt', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    console.log(`Mode: ${apply ? 'APPLY' : 'DRY RUN'}`);
    console.log(`AppUser records total: ${total}`);
    console.log(`Records failing prompt >= 1: ${affected}`);
    for (const { _id, count } of groups) {
      const label = _id === null || _id === undefined ? '<missing/null>' : String(_id);
      console.log(`  prompt=${label}: ${count} account(s) -> ${DEFAULT_PROMPT}`);
    }

    if (affected === 0) {
      console.log('Nothing to migrate. Every record already satisfies the constraint.');
      return;
    }

    if (!apply) {
      console.log(
        `Dry run only. Re-run with --apply to set prompt=${DEFAULT_PROMPT} on the ${affected} record(s) above.`
      );
      return;
    }

    // Update validators run only against the paths in this update, so an
    // unrelated invalid field elsewhere on a document cannot block the write.
    const result = await AppUser.updateMany(
      INVALID_PROMPT_FILTER,
      { $set: { prompt: DEFAULT_PROMPT } },
      { runValidators: true }
    );

    const remaining = await AppUser.countDocuments(INVALID_PROMPT_FILTER);

    console.log(`Matched ${result.matchedCount}, modified ${result.modifiedCount}.`);
    if (remaining === 0) {
      console.log('Migration complete. No records fail the prompt constraint.');
    } else {
      console.error(`Migration incomplete: ${remaining} record(s) still fail the constraint.`);
      process.exitCode = 1;
    }
  } finally {
    await mongoose.disconnect();
  }
}

main().catch(() => {
  console.error('AppUser prompt migration failed. Check database connectivity.');
  process.exitCode = 1;
});
