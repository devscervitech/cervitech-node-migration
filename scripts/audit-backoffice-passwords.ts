/**
 * Read-only inventory of back-office password storage.
 *
 * Reports counts only. It never prints account identifiers or password values
 * and does not modify the database. Run with the intended environment loaded:
 *   npx dotenv -e .env.dev -- npx tsx scripts/audit-backoffice-passwords.ts
 */

import mongoose from 'mongoose';
import BackofficeUser from '../src/models/BackOfficeUser';
import BackofficeSecurityState, {
  ACTIVE_BACKOFFICE_ADMIN_STATE_ID,
} from '../src/models/BackofficeSecurityState';
import { BACKOFFICE_ACCESS_LEVEL } from '../src/enums/backofficeAccessLevel';

const BCRYPT_HASH = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

function safeErrorCategory(error: unknown): string {
  if (typeof error !== 'object' || error === null) return 'UnknownError';

  const outer = error as { name?: unknown; code?: unknown; cause?: unknown };
  const parts: string[] = [];
  if (typeof outer.name === 'string') parts.push(outer.name);
  if (typeof outer.code === 'string' || typeof outer.code === 'number') {
    parts.push(`code=${outer.code}`);
  }

  if (typeof outer.cause === 'object' && outer.cause !== null) {
    const cause = outer.cause as { name?: unknown; code?: unknown };
    if (typeof cause.name === 'string') parts.push(`cause=${cause.name}`);
    if (typeof cause.code === 'string' || typeof cause.code === 'number') {
      parts.push(`causeCode=${cause.code}`);
    }
  }

  return parts.length > 0 ? parts.join(', ') : 'UnknownError';
}

function safeErrorHint(error: unknown): string {
  if (typeof error !== 'object' || error === null) return 'Check the connection setup.';
  const detail = error as { name?: unknown; message?: unknown };
  const message = typeof detail.message === 'string' ? detail.message : '';

  if (message.includes('Invalid scheme')) {
    return 'Use a URI beginning with mongodb:// or mongodb+srv://.';
  }
  if (message.includes('Protocol and host list are required')) {
    return 'The URI is missing a host; copy the full connection string from Atlas.';
  }
  if (message.includes('Username contains unescaped characters')) {
    return 'Percent-encode reserved characters in the database username.';
  }
  if (message.includes('Password contains unescaped characters')) {
    return 'Percent-encode reserved characters in the database password.';
  }
  if (message.includes('URI contained empty userinfo section')) {
    return 'The username/password section before @ is empty or malformed.';
  }
  if (message.includes('mongodb+srv URI cannot have port number')) {
    return 'Remove the port number from an mongodb+srv:// URI.';
  }
  if (message.includes('mongodb+srv URI cannot have multiple service names')) {
    return 'Use a single Atlas cluster hostname in the mongodb+srv:// URI.';
  }
  if (message.includes('Invalid connection string')) {
    return 'The URI has invalid formatting; remove copied quotes, brackets, or Markdown link syntax.';
  }
  if (detail.name === 'MongoParseError') {
    return 'Check URI punctuation, reserved characters in credentials, and query option syntax.';
  }
  return 'Check the development URI, credentials, network/VPN, and database IP allowlist.';
}

function safeUriShape(uri: string): string {
  const atIndex = uri.lastIndexOf('@');
  const authority = uri.startsWith('mongodb+srv://')
    ? uri.slice('mongodb+srv://'.length, atIndex >= 0 ? atIndex : undefined)
    : uri.startsWith('mongodb://')
      ? uri.slice('mongodb://'.length, atIndex >= 0 ? atIndex : undefined)
      : '';

  return [
    `exactMongoScheme=${uri.startsWith('mongodb://') || uri.startsWith('mongodb+srv://')}`,
    `leadingWhitespace=${/^\s/.test(uri)}`,
    `leadingBOM=${uri.charCodeAt(0) === 0xfeff}`,
    `startsWithAssignment=${/^\s*MONGODB_URI\s*=/.test(uri)}`,
    `startsWithQuote=${/^["']/.test(uri)}`,
    `containsMarkdownLink=${uri.includes('](') || uri.includes('mailto:')}`,
    `containsLineBreak=${/[\r\n]/.test(uri)}`,
    `authorityHasCredentials=${authority.includes(':')}`,
  ].join(', ');
}

async function main() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('MONGODB_URI is not set. Load the intended environment before running this audit.');
    process.exitCode = 1;
    return;
  }

  const hasMongoScheme =
    mongoUri.startsWith('mongodb://') || mongoUri.startsWith('mongodb+srv://');
  console.log(`URI shape check (flags only): ${safeUriShape(mongoUri)}`);
  if (!hasMongoScheme) {
    console.error(
      'MONGODB_URI must be the complete MongoDB connection URI beginning with mongodb:// or mongodb+srv://. No connection was attempted.'
    );
    process.exitCode = 1;
    return;
  }

  try {
    await mongoose.connect(mongoUri);

    const [total, missingOrEmpty, unrecognizedHash, accessLevelCounts, activeAdminCount, adminState] = await Promise.all([
      BackofficeUser.countDocuments(),
      BackofficeUser.countDocuments({
        $or: [
          { password: { $exists: false } },
          { password: null },
          { password: '' },
        ],
      }),
      BackofficeUser.countDocuments({
        password: {
          $exists: true,
          $nin: [null, ''],
          $not: BCRYPT_HASH,
        },
      }),
      BackofficeUser.aggregate<{ _id: string; count: number }>([
        {
          $group: {
            _id: { $ifNull: ['$accessLevel', '<missing>'] },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      BackofficeUser.countDocuments({
        accessLevel: BACKOFFICE_ACCESS_LEVEL.ADMIN,
        readOnly: false,
      }),
      BackofficeSecurityState.findById(ACTIVE_BACKOFFICE_ADMIN_STATE_ID).lean(),
    ]);

    console.log('Back-office password audit (read-only)');
    console.log(`Total accounts: ${total}`);
    console.log(`Missing or empty passwords: ${missingOrEmpty}`);
    console.log(`Non-bcrypt or unrecognized password values: ${unrecognizedHash}`);
    console.log(`Bcrypt-formatted password hashes: ${total - missingOrEmpty - unrecognizedHash}`);
    console.log('Existing accessLevel counts:');
    for (const { _id, count } of accessLevelCounts) {
      console.log(`  ${_id}: ${count}`);
    }
    console.log(`Active ADMIN accounts: ${activeAdminCount}`);
    console.log(
      `Stored active-admin invariant count: ${adminState?.activeAdminCount ?? 'not initialized'}`
    );
    console.log(
      `Admin mutation lock: ${adminState?.adminMutationLocked === true ? 'held' : adminState ? 'released' : 'not initialized'}`
    );
    console.log('No account identifiers or password values were output. No database writes were performed.');
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(
    `Back-office password audit failed (${safeErrorCategory(error)}). ${safeErrorHint(error)} The URI and raw error message were not logged.`
  );
  process.exitCode = 1;
});
