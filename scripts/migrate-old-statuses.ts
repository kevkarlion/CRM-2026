import { config } from 'dotenv';
config({ path: '.env.local' });

import mongoose from 'mongoose';
const { connectDB } = await import('../src/core/db');
const { TenantModel } = await import('../src/core/models');
const { LeadModel } = await import('../src/leads/models');

async function migrate() {
  await connectDB();

  const tenant = await TenantModel.findOne({ deletedAt: null }).lean();
  if (!tenant) { console.error('No tenant'); process.exit(1); }
  const tid = tenant._id;

  // qualified → negotiation (calificados presupuestados)
  const q = await LeadModel.updateMany(
    { tenantId: tid, status: 'qualified', deletedAt: null },
    { $set: { status: 'negotiation', updatedBy: 'seed-migration' } }
  );
  console.log(`qualified → negotiation: ${q.modifiedCount}`);

  // disqualified → lost
  const d = await LeadModel.updateMany(
    { tenantId: tid, status: 'disqualified', deletedAt: null },
    {
      $set: {
        status: 'lost',
        updatedBy: 'seed-migration',
        qualificationStatus: 'not_qualified',
        lostReason: 'other',
        lostDescription: 'Migrado de disqualified a lost',
      },
    }
  );
  console.log(`disqualified → lost: ${d.modifiedCount}`);

  // Show final distribution
  const byStatus = await LeadModel.aggregate([
    { $match: { tenantId: tid, deletedAt: null } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);
  console.log('\nDistribución final:');
  for (const s of byStatus) console.log(`  ${s._id}: ${s.count}`);

  await mongoose.disconnect();
  console.log('\n✅ Migración completa');
}

migrate().catch(err => { console.error(err); process.exit(1); });
