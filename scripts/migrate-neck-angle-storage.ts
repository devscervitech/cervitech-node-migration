/**
 * B12 data migration for neck-angle storage. Dry-run by default; pass
 * --apply to write. Idempotent — safe to re-run, and safe while the API is
 * serving traffic.
 *
 * Run it AFTER deploying the B12 code (which stops $push-ing readings into
 * AppUser and reserves counters atomically). Running it again later is a
 * no-op apart from re-checking.
 *
 * Steps:
 *   1. Build the B12 indexes, so large collections are indexed at a time you
 *      choose rather than by autoIndex at boot.
 *   2. Report the largest AppUser documents (16 MB is MongoDB's hard limit).
 *   3. For every user still carrying an embedded `neckAngleRecords` array:
 *      copy any reading that exists only in the embedded copy into the
 *      NeckAngleRecord collection, then $unset the array. Nothing is removed
 *      unless a copy exists in the collection.
 *   4. Seed `AppUser.neckAngleRecordCounter` from each user's highest stored
 *      counter with $max, so it never moves a live counter backwards.
 *
 * Usage:
 *   dotenv -e .env.prod -- npm run migrate:neck-angle-storage
 *   dotenv -e .env.prod -- npm run migrate:neck-angle-storage -- --apply
 */

import mongoose from 'mongoose';
import { createHash } from 'crypto';
import AppUser from '../src/models/AppUser';
import { NeckAngleRecordModel } from '../src/models/NeckAngleRecord';
import TransactionRecord from '../src/models/TransactionRecord';
import TokenBlacklist from '../src/models/TokenBlacklist';
import JobRun from '../src/models/JobRun';
import JobLease from '../src/models/JobLease';
import { Goal } from '../src/models/Goal';
import { GoalCycleCompletionReport } from '../src/models/GoalCycleCompletionReport';
import { PushNotificationLog } from '../src/models/PushNotificationLog';
import ResponseRate from '../src/models/ResponseRate';
import { classifyIndex, tokenBlacklistIndexSpec } from './migrationIndex.util';

const DB_NAME = 'cervitechdb'; // matches the dbName forced in src/server.ts
const LOOKUP_CHUNK = 1000;
const WRITE_CHUNK = 1000;
const LARGEST_DOCS_TO_REPORT = 10;

type IndexSpec = {
  collection: mongoose.mongo.Collection;
  key: Record<string, 1 | -1>;
  options?: mongoose.mongo.CreateIndexesOptions;
};

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function ensureIndexes(apply: boolean) {
  const specs: IndexSpec[] = [
    { collection: NeckAngleRecordModel.collection as any, key: { appUserId: 1, dateTimeRecorded: -1 } },
    { collection: NeckAngleRecordModel.collection as any, key: { appUserId: 1, counter: -1 } },
    { collection: TransactionRecord.collection as any, key: { appUserId: 1 } },
    {
      collection: TransactionRecord.collection as any,
      key: { appUserId: 1, status: 1, nextVerificationAt: 1, statusChangedAt: 1 },
      options: { partialFilterExpression: { purchaseToken: { $type: 'string' } } },
    },
    {
      collection: TransactionRecord.collection as any,
      key: { status: 1, nextVerificationAt: 1, appUserId: 1, statusChangedAt: 1 },
      options: { partialFilterExpression: { purchaseToken: { $type: 'string' } } },
    },
    { collection: TokenBlacklist.collection as any, ...tokenBlacklistIndexSpec },
    { collection: ResponseRate.collection as any, key: { appUserId: 1 } },
    { collection: Goal.collection as any, key: { nextCycleEndsAt: 1 } },
    { collection: Goal.collection as any, key: { appUserId: 1, dateSet: -1 } },
    {
      collection: GoalCycleCompletionReport.collection as any,
      key: { goalId: 1, dateOfConcludedCycle: 1 },
      options: {
        unique: true,
        partialFilterExpression: { goalId: { $exists: true } },
      },
    },
    {
      collection: PushNotificationLog.collection as any,
      key: { status: 1, sentAt: 1, ticketId: 1 },
    },
    { collection: JobRun.collection as any, key: { job: 1, monthKey: 1 }, options: { unique: true } },
    { collection: JobRun.collection as any, key: { expiresAt: 1 }, options: { expireAfterSeconds: 0 } },
    { collection: JobLease.collection as any, key: { job: 1 }, options: { unique: true } },
    { collection: AppUser.collection as any, key: { deleted: 1, lastLoginDateTime: 1 } },
    { collection: AppUser.collection as any, key: { deleted: 1, allowPushNotifications: 1, isGoalOn: 1, dateRegistered: 1, lastGoalReminderSentAt: 1, fcmToken: 1 } },
    { collection: AppUser.collection as any, key: { deleted: 1, allowPushNotifications: 1, dateRegistered: 1, lastCheckInReminderSentAt: 1, fcmToken: 1 } },
    { collection: AppUser.collection as any, key: { deleted: 1, allowPushNotifications: 1, isGoalOn: 1, lastGoalReminderSentAt: 1, fcmToken: 1 } },
    { collection: AppUser.collection as any, key: { deleted: 1, allowPushNotifications: 1, lastBadPostureAlertSentAt: 1, fcmToken: 1 } },
  ];

  console.log('\n[1/4] Indexes');
  for (const spec of specs) {
    const label = `${spec.collection.collectionName} ${JSON.stringify(spec.key)}`;
    let existing: { key?: Record<string, number> }[] = [];
    try {
      existing = (await spec.collection.indexes()) as any;
    } catch (error: any) {
      if (error?.code !== 26) throw error; // NamespaceNotFound: collection not created yet
    }
    const indexStatus = classifyIndex(existing as any[], spec);
    if (indexStatus === 'ok') {
      console.log(`  ok       ${label}`);
    } else if (indexStatus === 'mismatch') {
      const message = `Index exists with different options: ${label}`;
      console.error(`  mismatch ${message}`);
      if (apply) throw new Error(`${message}. Resolve the index conflict manually before applying.`);
    } else if (apply) {
      await spec.collection.createIndex(spec.key, spec.options ?? {});
      console.log(`  created  ${label}`);
    } else {
      console.log(`  missing  ${label} (would create)`);
    }
  }
}

async function reportLargestUsers() {
  console.log('\n[2/4] Largest AppUser documents');
  try {
    const largest = await AppUser.collection
      .aggregate([
        {
          $project: {
            bytes: { $bsonSize: '$$ROOT' },
            embedded: { $size: { $ifNull: ['$neckAngleRecords', []] } },
          },
        },
        { $sort: { bytes: -1 } },
        { $limit: LARGEST_DOCS_TO_REPORT },
      ])
      .toArray();
    for (const doc of largest) {
      const mb = (doc.bytes / (1024 * 1024)).toFixed(2);
      console.log(`  ${doc._id}  ${mb} MB  (${doc.embedded} embedded readings)`);
    }
    if (largest.length === 0) console.log('  (no users)');
  } catch (error: any) {
    // $bsonSize needs MongoDB 4.4+; the report is informational only.
    console.log(`  skipped: ${error?.message ?? error}`);
  }
}

async function reconcileEmbeddedRecords(apply: boolean) {
  console.log('\n[3/4] Embedded readings → collection, then unset');
  const records = NeckAngleRecordModel.collection;
  const cursor = AppUser.collection.find(
    { 'neckAngleRecords.0': { $exists: true } },
    { projection: { neckAngleRecords: 1 } }
  );

  let users = 0;
  let embedded = 0;
  let missing = 0;
  let unset = 0;

  for await (const user of cursor) {
    users++;
    const appUserId = String(user._id);
    const items: any[] = Array.isArray(user.neckAngleRecords) ? user.neckAngleRecords : [];
    embedded += items.length;

    const stableId = (record: any, index: number) => {
      if (record?._id && mongoose.isValidObjectId(record._id)) {
        return new mongoose.Types.ObjectId(record._id);
      }
      const bytes = createHash('sha256').update(`${appUserId}:${index}`).digest().subarray(0, 12);
      return new mongoose.Types.ObjectId(bytes);
    };
    const candidates = items.map((record, index) => ({
      _id: stableId(record, index),
      appUserId, // the owning document is authoritative
      angle: record?.angle,
      craniumVertebralAngle: record?.craniumVertebralAngle,
      dateTimeRecorded: record?.dateTimeRecorded ? new Date(record.dateTimeRecorded) : undefined,
      counter: typeof record?.counter === 'number' ? record.counter : 0,
    }));
    const existingById = new Map<string, any>();
    for (const ids of chunk(candidates.map((record) => record._id), LOOKUP_CHUNK)) {
      const found = await records
        .find({ _id: { $in: ids } }, {
          projection: {
            _id: 1,
            appUserId: 1,
            angle: 1,
            craniumVertebralAngle: 1,
            dateTimeRecorded: 1,
            counter: 1,
          },
        })
        .toArray();
      for (const record of found) existingById.set(String(record._id), record);
    }

    const sameReading = (left: any, right: any) => Boolean(left) &&
      String(left.appUserId) === String(right.appUserId) &&
      left.angle === right.angle &&
      left.craniumVertebralAngle === right.craniumVertebralAngle &&
      new Date(left.dateTimeRecorded).getTime() === new Date(right.dateTimeRecorded).getTime() &&
      left.counter === right.counter;
    const toInsert: any[] = [];
    for (const candidate of candidates) {
      const existing = existingById.get(String(candidate._id));
      if (existing && !sameReading(existing, candidate)) {
        throw new Error(
          `Record ID conflict for user ${appUserId}; embedded data was retained for manual review.`
        );
      }
      if (!existing) toInsert.push(candidate);
    }
    missing += toInsert.length;

    if (!apply) continue;

    for (const batch of chunk(toInsert, WRITE_CHUNK)) {
      try {
        await records.insertMany(batch, { ordered: false });
      } catch (error: any) {
        // A duplicate _id means a copy already exists — that is the goal.
        const onlyDuplicates =
          Array.isArray(error?.writeErrors) && error.writeErrors.every((e: any) => e.code === 11000);
        if (!onlyDuplicates) throw error;
      }
    }

    // Verify the destination copies after a partial write or duplicate race.
    // A duplicate _id is safe only when the owner and every reading value match.
    const verifiedById = new Map<string, any>();
    for (const ids of chunk(candidates.map((record) => record._id), LOOKUP_CHUNK)) {
      const found = await records
        .find({ _id: { $in: ids } }, {
          projection: {
            _id: 1,
            appUserId: 1,
            angle: 1,
            craniumVertebralAngle: 1,
            dateTimeRecorded: 1,
            counter: 1,
          },
        })
        .toArray();
      for (const record of found) verifiedById.set(String(record._id), record);
    }
    if (candidates.some((record) => !sameReading(verifiedById.get(String(record._id)), record))) {
      throw new Error(`One or more readings for user ${appUserId} were not copied exactly; source retained.`);
    }

    // Only unset the exact array that was read. If the old application adds a
    // reading during this migration, the compare-and-set fails and preserves it.
    const removed = await AppUser.collection.updateOne(
      { _id: user._id, neckAngleRecords: { $eq: items } },
      { $unset: { neckAngleRecords: '' } }
    );
    if (removed.modifiedCount === 1) {
      unset++;
    } else {
      const current = await AppUser.collection.findOne(
        { _id: user._id },
        { projection: { neckAngleRecords: 1 } }
      );
      if (Array.isArray(current?.neckAngleRecords)) {
        throw new Error(`Embedded readings for user ${appUserId} changed during migration; source retained.`);
      }
    }
  }

  console.log(`  users with embedded readings: ${users}`);
  console.log(`  embedded readings:            ${embedded}`);
  console.log(`  missing from collection:      ${missing}${apply ? ' (copied)' : ' (would copy)'}`);
  console.log(`  arrays unset:                 ${apply ? unset : `0 (would unset ${users})`}`);
}

async function seedCounters(apply: boolean) {
  console.log('\n[4/4] Seed neckAngleRecordCounter');
  const cursor = NeckAngleRecordModel.collection
    .aggregate<{ _id: string; maxCounter: number }>(
      [{ $group: { _id: '$appUserId', maxCounter: { $max: '$counter' } } }],
      { allowDiskUse: true, batchSize: WRITE_CHUNK }
    );

  let usersWithReadings = 0;
  let modified = 0;
  let ops: any[] = [];
  const writeBatch = async () => {
    if (!apply || ops.length === 0) {
      ops = [];
      return;
    }
    const result = await AppUser.collection.bulkWrite(ops, { ordered: false });
    modified += result.modifiedCount;
    ops = [];
  };

  for await (const maximum of cursor) {
    if (typeof maximum.maxCounter !== 'number' || !mongoose.isValidObjectId(maximum._id)) continue;
    usersWithReadings++;
    ops.push({
      updateOne: {
        filter: { _id: new mongoose.Types.ObjectId(maximum._id) },
        update: { $max: { neckAngleRecordCounter: maximum.maxCounter } },
      },
    });
    if (ops.length >= WRITE_CHUNK) await writeBatch();
  }
  await writeBatch();

  console.log(`  users with readings: ${usersWithReadings}`);
  if (!apply) {
    console.log('  (dry run — no counters written)');
    return;
  }
  console.log(`  counters raised: ${modified}`);
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
    await mongoose.connect(mongoUri, { dbName: DB_NAME, autoIndex: false });
    console.log(`Mode: ${apply ? 'APPLY' : 'DRY RUN'}  (database: ${DB_NAME})`);
    await ensureIndexes(apply);
    await reportLargestUsers();
    await reconcileEmbeddedRecords(apply);
    await seedCounters(apply);
    console.log('\nDone.');
  } catch (error) {
    console.error('Migration failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

void main();
