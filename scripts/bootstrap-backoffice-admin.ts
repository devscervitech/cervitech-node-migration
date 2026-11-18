/**
 * One-time administrator provisioning.
 *
 * Safety rules:
 * - Refuses to run if a canonical ADMIN already exists.
 * - Promotes only the specifically named existing account, or creates an
 *   account only when the back-office collection is empty.
 * - Reads the password from the environment, removes all whitespace, and
 *   never prints the password or account data.
 *
 * Load MONGODB_URI and BACKOFFICE_BOOTSTRAP_PASSWORD from a secret manager,
 * then run: npx tsx scripts/bootstrap-backoffice-admin.ts
 * For a new empty collection, also provide username, email, first and last
 * name. For an existing account, provide its exact username to promote it.
 */

import mongoose from 'mongoose';
import BackofficeUser from '../src/models/BackOfficeUser';
import BackofficeSecurityState, {
  ACTIVE_BACKOFFICE_ADMIN_STATE_ID,
} from '../src/models/BackofficeSecurityState';
import { BACKOFFICE_ACCESS_LEVEL } from '../src/enums/backofficeAccessLevel';
import { signupSchema } from '../src/validation/schemas/auth.schema';
import { createBackofficeUserSchema } from '../src/validation/schemas/backOfficeUser.schema';
import { HashUtil } from '../src/utils/hash';
import { normalizePassword } from '../src/utils/password.util';

async function syncActiveAdminCount() {
  const activeAdminCount = await BackofficeUser.countDocuments({
    accessLevel: BACKOFFICE_ACCESS_LEVEL.ADMIN,
    readOnly: false,
  });
  await BackofficeSecurityState.updateOne(
    { _id: ACTIVE_BACKOFFICE_ADMIN_STATE_ID },
    { $set: { activeAdminCount, adminMutationLocked: false } },
    { upsert: true }
  );
}

async function main() {
  const mongoUri = process.env.MONGODB_URI;
  const username = process.env.BACKOFFICE_BOOTSTRAP_USERNAME?.trim();
  const suppliedPassword = process.env.BACKOFFICE_BOOTSTRAP_PASSWORD;

  if (!mongoUri || !username || suppliedPassword === undefined) {
    console.error(
      'Set MONGODB_URI, BACKOFFICE_BOOTSTRAP_USERNAME, and BACKOFFICE_BOOTSTRAP_PASSWORD through the deployment secret manager.'
    );
    process.exitCode = 1;
    return;
  }

  const password = normalizePassword(suppliedPassword);
  const passwordValidation = signupSchema.extract('password').validate(password);
  if (passwordValidation.error) {
    console.error('The normalized bootstrap password does not meet the password policy.');
    process.exitCode = 1;
    return;
  }

  try {
    await mongoose.connect(mongoUri);

    const activeAdminCount = await BackofficeUser.countDocuments({
      accessLevel: BACKOFFICE_ACCESS_LEVEL.ADMIN,
      readOnly: false,
    });
    if (activeAdminCount > 0) {
      console.error('An active back-office administrator already exists; refusing bootstrap.');
      process.exitCode = 1;
      return;
    }

    const account = await BackofficeUser.findOne({ username }).select('+password');
    const accountCount = await BackofficeUser.countDocuments();
    const hashedPassword = await HashUtil.hash(password);

    if (account) {
      account.accessLevel = BACKOFFICE_ACCESS_LEVEL.ADMIN;
      account.readOnly = false;
      account.password = hashedPassword;
      await account.save();
      await syncActiveAdminCount();
      console.log('The designated existing account is now the initial administrator.');
      return;
    }

    if (accountCount > 0) {
      console.error(
        'Back-office accounts already exist. Set BACKOFFICE_BOOTSTRAP_USERNAME to the designated existing account; no account was created.'
      );
      process.exitCode = 1;
      return;
    }

    const firstName = process.env.BACKOFFICE_BOOTSTRAP_FIRST_NAME?.trim();
    const lastName = process.env.BACKOFFICE_BOOTSTRAP_LAST_NAME?.trim();
    const email = process.env.BACKOFFICE_BOOTSTRAP_EMAIL?.trim();
    if (!firstName || !lastName || !email) {
      console.error(
        'For an empty collection, also set BACKOFFICE_BOOTSTRAP_FIRST_NAME, BACKOFFICE_BOOTSTRAP_LAST_NAME, and BACKOFFICE_BOOTSTRAP_EMAIL.'
      );
      process.exitCode = 1;
      return;
    }

    const newAdminInput = {
      firstName,
      lastName,
      email,
      username,
      password,
      accessLevel: BACKOFFICE_ACCESS_LEVEL.ADMIN,
      readOnly: false,
    };
    const validation = createBackofficeUserSchema.validate(newAdminInput, {
      abortEarly: false,
      allowUnknown: false,
      convert: true,
    });
    if (validation.error) {
      console.error('Bootstrap profile fields are invalid; no account was created.');
      process.exitCode = 1;
      return;
    }

    validation.value.password = hashedPassword;
    await BackofficeUser.create(validation.value);
    await syncActiveAdminCount();
    console.log('The initial back-office administrator was created.');
  } finally {
    await mongoose.disconnect();
  }
}

main().catch(() => {
  console.error('Back-office administrator provisioning failed. Check database connectivity and permissions.');
  process.exitCode = 1;
});
