import mongoose from 'mongoose';
import AppUser from '../src/models/AppUser';

const EMAILS: string[] = [
  'jnrdev01@gmail.com',
  'akoduashiyat@gmail.com'
];

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