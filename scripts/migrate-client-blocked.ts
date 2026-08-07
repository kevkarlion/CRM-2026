import { config } from 'dotenv';
config({ path: '.env.local' });

import mongoose from 'mongoose';
const { connectDB } = await import('../src/core/db');
import { ClientModel } from '../src/crm/models';

/**
 * Migration: legacy `blacklisted` status → canonical `blocked` status.
 *
 * The old `blacklisted` value was a ghost: it existed in the enum and label
 * maps but had no write paths. This migration renames it to `blocked` and,
 * for every migrated document, pushes an OPEN block history entry so the
 * domain invariant "status 'blocked' ⇒ exactly one open entry
 * (unblockedAt = null)" holds from day one.
 *
 * Idempotent: the filter targets only documents still in `blacklisted`, so
 * re-running never double-pushes history or rewrites already-migrated docs.
 *
 * Run ad-hoc: npx tsx scripts/migrate-client-blocked.ts
 */
async function migrate() {
  console.log('Conectando…');
  await connectDB();
  console.log('Conectado.\n');

  const total = await ClientModel.countDocuments({ status: 'blacklisted' });
  console.log(`Clientes con estado 'blacklisted': ${total}\n`);

  const result = await ClientModel.updateMany(
    { status: 'blacklisted' },
    [
      {
        $set: {
          status: 'blocked',
          blockHistory: {
            $concatArrays: [
              { $ifNull: ['$blockHistory', []] },
              [
                {
                  reason: 'Migrado desde estado blacklisted',
                  blockedAt: { $ifNull: ['$createdAt', '$$NOW'] },
                  blockedBy: null,
                },
              ],
            ],
          },
        },
      },
    ]
  );

  console.log('Resumen:');
  console.log(`  Coincidencias: ${result.matchedCount}`);
  console.log(`  Clientes migrados: ${result.modifiedCount}`);

  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error('failed:', err);
  process.exit(1);
});
