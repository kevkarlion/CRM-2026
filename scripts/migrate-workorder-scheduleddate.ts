import { config } from 'dotenv';
config({ path: '.env.local' });

import { MongoClient, Db } from 'mongodb';

async function migrate() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGODB_URL;
  if (!mongoUri) {
    console.error('No MONGODB_URI found in .env.local');
    process.exit(1);
  }

  const client = new MongoClient(mongoUri);
  await client.connect();

  const db: Db = client.db();
  const tenants = await db.collection('tenants').find({ deletedAt: null }).toArray();
  
  if (tenants.length === 0) {
    console.error('No tenant found');
    await client.close();
    process.exit(1);
  }
  
  const tid = tenants[0]._id;
  console.log(`🔍 Buscando OTs con inconsistencia en scheduledDate...\n`);

  const workOrders = await db.collection('workorders').find({
    tenantId: tid,
    deletedAt: null,
    scheduledStart: { $exists: true, $ne: null },
  }).toArray();

  let corrected = 0;
  let alreadyCorrect = 0;

  for (const wo of workOrders) {
    const startDate = wo.scheduledStart instanceof Date 
      ? wo.scheduledStart.toISOString().slice(0, 10)
      : new Date(wo.scheduledStart).toISOString().slice(0, 10);

    // Case 1: scheduledDate doesn't exist or is empty
    if (!wo.scheduledDate) {
      await db.collection('workorders').updateOne(
        { _id: wo._id },
        { $set: { scheduledDate: startDate } }
      );
      console.log(`  ➕ OT ${wo.workOrderNumber}: agregué scheduledDate = ${startDate}`);
      corrected++;
      continue;
    }

    // Case 2: scheduledDate exists but different from scheduledStart
    const existingDate = wo.scheduledDate.slice(0, 10);
    if (existingDate !== startDate) {
      await db.collection('workorders').updateOne(
        { _id: wo._id },
        { $set: { scheduledDate: startDate } }
      );
      console.log(`  🔄 OT ${wo.workOrderNumber}: ${wo.scheduledDate} → ${startDate}`);
      corrected++;
    } else {
      alreadyCorrect++;
    }
  }

  // Summary
  console.log('\n--- Resumen ---');
  console.log(`Total OTs con scheduledStart: ${workOrders.length}`);
  console.log(`Ya correctas: ${alreadyCorrect}`);
  console.log(`Corrigiendo scheduledDate: ${corrected}`);

  // Show remaining issues
  const orphaned = await db.collection('workorders').countDocuments({
    tenantId: tid,
    deletedAt: null,
    scheduledDate: { $exists: true, $ne: '' },
    scheduledStart: { $exists: false },
  });
  console.log(`⚠️  OTs con scheduledDate pero sin scheduledStart: ${orphaned}`);

  // Fix OTs with scheduledDate but no scheduledStart (derive scheduledStart from scheduledDate)
  if (orphaned > 0) {
    console.log('\n🔧 Derivando scheduledStart desde scheduledDate...\n');
    
    const orphanedWOs = await db.collection('workorders').find({
      tenantId: tid,
      deletedAt: null,
      scheduledDate: { $exists: true, $ne: '' },
      scheduledStart: { $exists: false },
    }).toArray();

    for (const wo of orphanedWOs) {
      const dateStr = wo.scheduledDate;
      // Default to 09:00 local time
      const scheduledStart = new Date(`${dateStr}T12:00:00.000Z`);
      const scheduledEnd = new Date(scheduledStart.getTime() + 240 * 60 * 1000); // 4 hours default
      
      await db.collection('workorders').updateOne(
        { _id: wo._id },
        { $set: { scheduledStart, scheduledEnd } }
      );
      console.log(`  ➕ OT ${wo.workOrderNumber}: derivé scheduledStart = ${dateStr} 12:00`);
    }
  }

  await client.close();
  console.log('\n✅ Migración completa');
}

migrate().catch(err => {
  console.error(err);
  process.exit(1);
});
