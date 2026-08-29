import { config } from 'dotenv';
config({ path: '.env.local' });

import mongoose from 'mongoose';
import UserModel from '../src/core/models/user';

// Connect directly instead of src/core/db.connectDB: that helper runs
// ensureWorkReportIndexes() (dropIndex/createIndex on work_reports) on every
// fresh connection, which would write to the DB even under --dry-run. This
// script only needs the users collection, so a plain connection is safe and
// keeps dry-run truly write-free.
async function localConnect() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/crm-2026';
  if (!process.env.MONGODB_URI) {
    console.warn('WARNING: MONGODB_URI not set — falling back to mongodb://localhost:27017/crm-2026');
  }
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(uri);
  }
}

/**
 * One-off repair for user records whose firstName/lastName is genuinely
 * missing or whitespace-only (legacy users may have bypassed User schema
 * validation). Each missing field is auto-filled with the user's full email
 * string verbatim. Existing non-empty values are never touched.
 *
 * Display fallback now lives in buildDisplayName (src/lib/build-display-name.ts);
 * this script makes the stored data usable by every consumer.
 *
 * Idempotent: after a run, no candidate document matches the missing-field
 * query, so re-running is a no-op.
 *
 * Reversible: every mutation is logged with id, field, original and new value,
 * and the migration doc (docs/database-migrations/) records the rollback
 * procedure from that log.
 *
 * Run ad-hoc: npx tsx scripts/repair-user-names.ts
 * Dry run:     npx tsx scripts/repair-user-names.ts --dry-run
 *   (prints exactly what would change without writing anything)
 */

// --dry-run prints the planned changes without touching the database.
const DRY_RUN = process.argv.includes('--dry-run');

function isMissing(value: unknown): boolean {
  return value == null || (typeof value === 'string' && value.trim() === '');
}

async function repair() {
  console.log('Connecting…');
  await localConnect();
  console.log('Connected.\n');

  const users = await UserModel.find({
    deletedAt: null,
    $or: [
      { firstName: { $in: [null, ''] } },
      { firstName: { $regex: /^\s*$/ } },
      { lastName: { $in: [null, ''] } },
      { lastName: { $regex: /^\s*$/ } },
    ],
  }).lean();

  console.log(`Users with missing/whitespace-only first or last name: ${users.length}\n`);
  if (DRY_RUN && users.length > 0) console.log('DRY RUN MODE: no changes will be written.\n');

  let usersUpdated = 0;
  let fieldsUpdated = 0;

  for (const user of users) {
    const updates: Record<string, string> = {};
    let hadChange = false;

    if (isMissing(user.firstName)) {
      updates.firstName = user.email;
      hadChange = true;
    }
    if (isMissing(user.lastName)) {
      updates.lastName = user.email;
      hadChange = true;
    }

    if (!hadChange) continue;

    if (!DRY_RUN) {
      await UserModel.updateOne({ _id: user._id }, { $set: updates });
    }
    usersUpdated += 1;
    fieldsUpdated += Object.keys(updates).length;

    for (const [field, newValue] of Object.entries(updates)) {
      const original = user[field as 'firstName' | 'lastName'];
      console.log(`  user=${user._id} field=${field} "${original}" -> "${newValue}"`);
    }
  }

  console.log('\nSummary:');
  if (DRY_RUN) {
    console.log(`  DRY RUN — users that would be updated: ${usersUpdated}`);
    console.log(`  DRY RUN — fields that would be filled: ${fieldsUpdated}`);
    console.log('  No changes were written.');
  } else {
    console.log(`  Users updated: ${usersUpdated}`);
    console.log(`  Fields filled with email: ${fieldsUpdated}`);
  }

  await mongoose.disconnect();
}

repair().catch((err) => {
  console.error('failed:', err);
  process.exit(1);
});