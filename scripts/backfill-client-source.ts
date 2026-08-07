import { config } from 'dotenv';
config({ path: '.env.local' });

import mongoose from 'mongoose';
const { connectDB } = await import('../src/core/db');
import { LeadModel } from '../src/leads/models';
import { ClientModel } from '../src/crm/models';

/**
 * Backfill for the new `source` field on Client.
 *
 * For every lead already converted to a client, copy `source`/`address`/
 * `locality`/`province` from the lead into the client ONLY when the client
 * value is missing. Idempotent: re-running never overwrites existing data.
 *
 * Run ad-hoc: npx tsx scripts/backfill-client-source.ts
 */
async function backfill() {
  console.log('Conectando…');
  await connectDB();
  console.log('Conectado.\n');

  const leads = await LeadModel.find({
    convertedToClient: { $ne: null },
    deletedAt: null,
  }).lean();

  console.log(`Leads convertidos encontrados: ${leads.length}\n`);

  let updatedClients = 0;
  let skippedClients = 0;

  for (const lead of leads) {
    const clientId = lead.convertedToClient;
    if (!clientId) continue;

    const client = await ClientModel.findById(clientId).lean();
    if (!client) {
      console.log(`  Skipping lead ${lead._id}: client ${clientId} no encontrado`);
      skippedClients += 1;
      continue;
    }

    const set: Record<string, unknown> = {};

    if (!client.source && lead.source) {
      set.source = lead.source;
    }
    if (!client.locality && lead.locality) {
      set.locality = lead.locality;
    }
    if (!client.address && lead.address) {
      set.address = lead.address;
    }
    if (!client.province && lead.province) {
      set.province = lead.province;
    }

    if (Object.keys(set).length === 0) {
      console.log(`  Lead ${lead._id} → Client ${clientId}: sin cambios (ya completos)`);
      skippedClients += 1;
      continue;
    }

    await ClientModel.updateOne(
      { _id: clientId },
      { $set: set },
    );
    updatedClients += 1;
    console.log(`  Lead ${lead._id} → Client ${clientId}: ${Object.keys(set).join(', ')}`);
  }

  console.log('\nResumen:');
  console.log(`  Clientes actualizados: ${updatedClients}`);
  console.log(`  Clientes sin cambios: ${skippedClients}`);

  await mongoose.disconnect();
}

backfill().catch((err) => {
  console.error('failed:', err);
  process.exit(1);
});
