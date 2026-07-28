import { config } from 'dotenv';
config({ path: '.env.local' });

import mongoose from 'mongoose';

async function connectDB() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/crm-2026';
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(uri);
  }
}

async function seed() {
  console.log('Connecting to MongoDB...');
  await connectDB();
  console.log('Connected.\n');

  const db = mongoose.connection.db!;

  // Find the tenant
  const tenant = await db.collection('tenants').findOne({});
  if (!tenant) {
    console.error('❌ No tenant found. Run seed.ts first.');
    process.exit(1);
  }
  const tenantId = tenant._id;
  console.log(`📍 Tenant: ${tenant.name} (${tenantId})`);

  // Find the user "Carlos Rodríguez"
  const user = await db.collection('users').findOne({ 
    email: 'carlos.rodriguez@crm.com', 
    tenantId, 
    deletedAt: null 
  });

  if (!user) {
    console.error('❌ User carlos.rodriguez@crm.com not found.');
    process.exit(1);
  }

  // Find the technician record
  const technician = await db.collection('technicians').findOne({ 
    userId: user._id, 
    tenantId,
    deletedAt: null 
  });

  if (!technician) {
    console.error('❌ Technician record not found for Carlos.');
    process.exit(1);
  }

  console.log(`👤 Carlos Rodríguez (${technician._id})`);

  // ============================================
  // 1. Assign more Work Orders to Carlos
  // ============================================
  console.log('\n📋 Assigning more Work Orders to Carlos...');

  // Get unassigned work orders
  const unassignedWOs = await db.collection('workorders')
    .find({ 
      tenantId, 
      deletedAt: null,
      status: { $in: ['scheduled', 'confirmed'] },
      $or: [
        { assignedTechnicians: { $size: 0 } },
        { assignedTechnicians: { $exists: false } }
      ]
    })
    .limit(5)
    .toArray();

  console.log(`   Found ${unassignedWOs.length} unassigned work orders`);

  for (const wo of unassignedWOs) {
    // Update work order
    await db.collection('workorders').updateOne(
      { _id: wo._id },
      { 
        $set: { 
          status: 'assigned',
          assignedTechnicians: [technician._id],
          updatedAt: new Date(),
          updatedBy: user._id
        } 
      }
    );

    // Create assignment record
    await db.collection('workorderassignments').insertOne({
      tenantId,
      workOrderId: wo._id,
      technicianId: technician._id,
      previousTechnicianId: null,
      assignmentType: 'manual',
      reason: 'other',
      reasonDetail: null,
      assignedBy: user._id,
      assignedAt: new Date(),
      acknowledgedAt: null,
      status: 'assigned',
      declinedAt: null,
      replacedAt: null,
      replacedByAssignmentId: null,
      notes: 'Asignado para pruebas',
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    console.log(`   ✅ WO #${wo.workOrderNumber}: ${wo.title}`);
  }

  // ============================================
  // 2. Assign Technical Visits to Carlos
  // ============================================
  console.log('\n🔧 Assigning Technical Visits to Carlos...');

  // Get unassigned technical visits
  const unassignedTVs = await db.collection('technicalvisits')
    .find({ 
      tenantId, 
      deletedAt: null,
      status: { $in: ['scheduled', 'confirmed'] },
      assignedTechnicianId: { $exists: false }
    })
    .limit(5)
    .toArray();

  console.log(`   Found ${unassignedTVs.length} unassigned technical visits`);

  for (const tv of unassignedTVs) {
    await db.collection('technicalvisits').updateOne(
      { _id: tv._id },
      { 
        $set: { 
          status: 'confirmed',
          assignedTechnicianId: technician._id,
          updatedAt: new Date(),
          updatedBy: user._id
        } 
      }
    );

    console.log(`   ✅ VT #${tv.visitNumber}: ${tv.title}`);
  }

  // ============================================
  // 3. Get summary of Carlos's assignments
  // ============================================
  console.log('\n📊 Resumen de asignaciones de Carlos:');

  const woCount = await db.collection('workorders').countDocuments({
    tenantId,
    assignedTechnicians: technician._id,
    deletedAt: null,
  });

  const tvCount = await db.collection('technicalvisits').countDocuments({
    tenantId,
    assignedTechnicianId: technician._id,
    deletedAt: null,
  });

  const inProgressWO = await db.collection('workorders').countDocuments({
    tenantId,
    assignedTechnicians: technician._id,
    deletedAt: null,
    status: { $in: ['assigned', 'en_route', 'on_site', 'paused'] },
  });

  const scheduledWO = await db.collection('workorders').countDocuments({
    tenantId,
    assignedTechnicians: technician._id,
    deletedAt: null,
    status: { $in: ['scheduled', 'confirmed'] },
  });

  const inProgressTV = await db.collection('technicalvisits').countDocuments({
    tenantId,
    assignedTechnicianId: technician._id,
    deletedAt: null,
    status: 'in_progress',
  });

  const scheduledTV = await db.collection('technicalvisits').countDocuments({
    tenantId,
    assignedTechnicianId: technician._id,
    deletedAt: null,
    status: { $in: ['scheduled', 'confirmed'] },
  });

  console.log(`   📋 Órdenes de Trabajo: ${woCount}`);
  console.log(`      - En progreso: ${inProgressWO}`);
  console.log(`      - Programadas: ${scheduledWO}`);
  console.log(`   🔧 Visitas Técnicas: ${tvCount}`);
  console.log(`      - En progreso: ${inProgressTV}`);
  console.log(`      - Programadas: ${scheduledTV}`);

  console.log('\n✅ Carlos Rodríguez now has OTs and VT assigned!\n');

  process.exit(0);
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});