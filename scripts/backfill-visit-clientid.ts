import { config } from 'dotenv';
config({ path: '.env.local' });

import mongoose from 'mongoose';
const { connectDB } = await import('../src/core/db');
import { TechnicalVisitModel } from '../src/operations/models';
import { LeadModel } from '../src/leads/models';

/**
 * Backfill for the new `clientId` field on TechnicalVisit.
 *
 * Visits created from leads carry only `leadId`. After a lead is converted,
 * the client may exist — so we copy `lead.convertedToClient` into
 * `visit.clientId` so the client detail page can show real visit data.
 *
 * Idempotent: re-running never overwrites an existing clientId.
 *
 * Run ad-hoc: npx tsx scripts/backfill-visit-clientid.ts
 */
async function backfill() {
  console.log('Conectando…');
  await connectDB();
  console.log('Conectado.\n');

  const visits = await TechnicalVisitModel.find({
    leadId: { $ne: null },
    clientId: null,
  }).lean();

  console.log(`Visitas con leadId y sin clientId encontradas: ${visits.length}\n`);

  let updatedVisits = 0;
  let skippedVisits = 0;

  for (const visit of visits) {
    if (!visit.leadId) continue;

    const lead = await LeadModel.findById(visit.leadId).lean();
    if (!lead || !lead.convertedToClient) {
      console.log(`  Skipping visit ${visit._id}: lead ${visit.leadId} sin cliente convertido`);
      skippedVisits += 1;
      continue;
    }

    await TechnicalVisitModel.updateOne(
      { _id: visit._id },
      { $set: { clientId: lead.convertedToClient } },
    );
    updatedVisits += 1;
    console.log(`  Visit ${visit._id} → client ${lead.convertedToClient}`);
  }

  console.log('\nResumen:');
  console.log(`  Visitas actualizadas: ${updatedVisits}`);
  console.log(`  Visitas sin cambios: ${skippedVisits}`);

  await mongoose.disconnect();
}

backfill().catch((err) => {
  console.error('failed:', err);
  process.exit(1);
});
