import { config } from 'dotenv';
config({ path: '.env.local' });

import mongoose from 'mongoose';
const { connectDB } = await import('../src/core/db');
import UserModel from '../src/core/models/user';

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
 */

function isMissing(value: unknown): boolean {
  return value == null || (typeof value === 'string' && value.trim() === '');
}

async function repair() {
  console.log('Connecting…');
  await connectDB();
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

    await UserModel.updateOne({ _id: user._id }, { $set: updates });
    usersUpdated += 1;
    fieldsUpdated += Object.keys(updates).length;

    for (const [field, newValue] of Object.entries(updates)) {
      const original = user[field as 'firstName' | 'lastName'];
      console.log(`  user=${user._id} field=${field} "${original}" -> "${newValue}"`);
    }
  }

  console.log('\nSummary:');
  console.log(`  Users updated: ${usersUpdated}`);
  console.log(`  Fields filled with email: ${fieldsUpdated}`);

  await mongoose.disconnect();
}

repair().catch((err) => {
  console.error('failed:', err);
  process.exit(1);
});