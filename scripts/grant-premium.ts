/**
 * One-time script to comp specific users into premium without a payment.
 *
 * What it does:
 *   - Looks up AppUser documents by email
 *   - Sets hasPaid = true
 *   - Prints a summary of who was updated, and who was NOT found
 *
 * It does NOT create a TransactionRecord — this is a manual override, not a
 * purchase. If you later add subscription-sync/expiry logic that revokes
 * hasPaid based on TransactionRecord state, these comped users will be
 * exempt from that (nothing to revoke), which is what you want for a
 * permanent comp. If you want a comp that expires, tell me and I'll adjust.
 *
 * Usage:
 *   1. Edit the EMAILS list below.
 *   2. Run against the right environment:
 *        npx dotenv -e .env.dev    -- npx tsx scripts/grant-premium.ts
 *        npx dotenv -e .env.staging -- npx tsx scripts/grant-premium.ts
 *        npx dotenv -e .env.prod   -- npx tsx scripts/grant-premium.ts
 *      (matches how your existing `dev`/`stage`/`prod` npm scripts load env)
 *   3. Read the printed summary before closing the terminal.
 */

import mongoose from 'mongoose';
import AppUser from '../src/models/AppUser';

// ---- EDIT THIS LIST ----
const EMAILS: string[] = [
  'email'
];
// -------------------------

async function main() {
  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    console.error('MONGODB_URI is not set. Run this with the right .env file loaded (see usage comment at top of this file).');
    process.exit(1);
  }

  if (EMAILS.length === 0) {
    console.error('EMAILS list is empty — add the emails you want to comp before running.');
    process.exit(1);
  }

  console.log(`Connecting to ${MONGODB_URI.replace(/\/\/.*@/, '//<redacted>@')} ...`);
  await mongoose.connect(MONGODB_URI);

  const normalizedEmails = EMAILS.map((e) => e.trim().toLowerCase());

  const updated: string[] = [];
  const alreadyPremium: string[] = [];
  const notFound: string[] = [];

  for (const email of normalizedEmails) {
    const user = await AppUser.findOne({ email });

    if (!user) {
      notFound.push(email);
      continue;
    }

    if (user.hasPaid) {
      alreadyPremium.push(email);
      continue;
    }

    user.hasPaid = true;
    await user.save();
    updated.push(email);
  }

  console.log('\n=== Grant Premium — Summary ===');
  console.log(`Updated (${updated.length}):`, updated.length ? updated.join(', ') : '(none)');
  console.log(`Already premium (${alreadyPremium.length}):`, alreadyPremium.length ? alreadyPremium.join(', ') : '(none)');
  console.log(`Not found (${notFound.length}):`, notFound.length ? notFound.join(', ') : '(none)');
  if (notFound.length > 0) {
    console.log('\nNote: "Not found" means no AppUser exists with that exact email — check for typos or that the user has signed up first.');
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});