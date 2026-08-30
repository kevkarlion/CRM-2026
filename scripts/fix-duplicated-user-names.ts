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
 * One-off repair for users whose name fields were polluted by a previous
 * repair script (scripts/repair-user-names.ts). That earlier run filled EVERY
 * missing name field with the full email, so users who had both firstName and
 * lastName empty ended up with firstName = email AND lastName = email. The
 * display name then read "ro.lija@hotmail.com ro.lija@hotmail.com".
 *
 * Rules applied here (conservative, email-only):
 * 1. If firstName and lastName are BOTH the same email value, lastName is
 *    cleared (an email is not a surname).
 * 2. If firstName is an email and lastName is a placeholder token ("User",
 *    "Usuario", "undefined", "null"), lastName is cleared too. A placeholder
 *    is never a real surname.
 *
 * Non-email last names are NEVER touched, even if they look odd.
 *
 * Idempotent: after a run, no candidate document matches the queries below,
 * so re-running is a no-op.
 *
 * Reversible: every mutation is logged with id, field, original and new value;
 * page 2 of the docs/database-migrations/ record defines the rollback.
 *
 * Run ad-hoc: npx tsx scripts/fix-duplicated-user-names.ts
 * Dry run:     npx tsx scripts/fix-duplicated-user-names.ts --dry-run
 *   (prints exactly what would change without writing anything)
 */

const DRY_RUN = process.argv.includes('--dry-run');

const PLACEHOLDER_LAST_NAMES = new Set(['user', 'usuario', 'undefined', 'null']);
const EMAIL_RE = /@/;

function isEmailLike(value: unknown): boolean {
  return typeof value === 'string' && EMAIL_RE.test(value);
}

function isPlaceholderSurname(value: unknown): boolean {
  return typeof value === 'string' && PLACEHOLDER_LAST_NAMES.has(value.trim().toLowerCase());
}

async function repair() {
  console.log('Connecting…');
  await localConnect();
  console.log('Connected.\n');

  const users = await UserModel.find({ deletedAt: null }).lean();
  const candidates = users.filter((user) => {
    const f = typeof user.firstName === 'string' ? user.firstName.trim() : '';
    const l = typeof user.lastName === 'string' ? user.lastName.trim() : '';

    const duplicatedEmail = isEmailLike(f) && l !== '' && f === l;
    const placeholderSurname = isEmailLike(f) && isPlaceholderSurname(user.lastName);
    return duplicatedEmail || placeholderSurname;
  });

  console.log(`Users with polluted name fields: ${candidates.length}\n`);
  if (DRY_RUN && candidates.length > 0) console.log('DRY RUN MODE: no changes will be written.\n');

  let usersUpdated = 0;

  for (const user of candidates) {
    const f = typeof user.firstName === 'string' ? user.firstName.trim() : '';
    const l = typeof user.lastName === 'string' ? user.lastName.trim() : '';
    const reason = f === l ? 'duplicated email in first+last' : 'placeholder surname';

    if (!DRY_RUN) {
      await UserModel.updateOne({ _id: user._id }, { $unset: { lastName: '' } });
    }
    usersUpdated += 1;

    console.log(`  user=${user._id} reason=${reason} email=${user.email} lastName "${l}" -> ""`);
  }

  console.log('\nSummary:');
  if (DRY_RUN) {
    console.log(`  DRY RUN — users that would be updated: ${usersUpdated}`);
    console.log('  No changes were written.');
  } else {
    console.log(`  Users updated: ${usersUpdated}`);
  }

  await mongoose.disconnect();
}

repair().catch((err) => {
  console.error('failed:', err);
  process.exit(1);
});