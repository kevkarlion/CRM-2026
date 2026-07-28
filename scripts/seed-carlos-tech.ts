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

  // Find the user "Carlos Rodríguez" (carlos.rodriguez@crm.com)
  const user = await db.collection('users').findOne({ 
    email: 'carlos.rodriguez@crm.com', 
    tenantId, 
    deletedAt: null 
  });

  if (!user) {
    console.error('❌ User carlos.rodriguez@crm.com not found. Run seed-carlos-rodriguez.ts first.');
    process.exit(1);
  }

  console.log(`👤 User: ${user.firstName} ${user.lastName} (${user._id})`);

  // Check if technician already exists
  const existingTech = await db.collection('technicians').findOne({ 
    userId: user._id, 
    tenantId,
    deletedAt: null 
  });

  if (existingTech) {
    console.log('⚠️  Technician record already exists for this user.');
  } else {
    // Create technician record
    await db.collection('technicians').insertOne({
      tenantId,
      userId: user._id,
      name: 'Carlos Rodríguez',
      firstName: 'Carlos',
      lastName: 'Rodríguez',
      email: 'carlos.rodriguez@crm.com',
      phone: '+54 9 11 3456-7890',
      specialties: ['aire acondicionado', 'refrigeración', 'informática'],
      zones: ['GBA Norte', 'GBA Este'],
      availability: 'available',
      maxDailyWorkOrders: 7,
      status: 'active',
      createdBy: tenantId,
      updatedBy: tenantId,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log('✅ Technician record created.');
  }

  // Now assign some work orders to this technician
  console.log('\n📋 Assigning sample work orders to Carlos Rodríguez...');

  // Get some pending work orders
  const workOrders = await db.collection('workorders')
    .find({ 
      tenantId, 
      deletedAt: null,
      status: { $in: ['scheduled', 'confirmed'] },
      assignedTechnicians: { $size: 0 }
    })
    .limit(3)
    .toArray();

  if (workOrders.length === 0) {
    console.log('⚠️  No pending work orders available to assign.');
  } else {
    const technician = await db.collection('technicians').findOne({ userId: user._id, tenantId });
    
    for (const wo of workOrders) {
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
        notes: null,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      console.log(`   ✅ Assigned WO #${wo.workOrderNumber}: ${wo.title}`);
    }
  }

  console.log('\n🎉 Carlos Rodríguez setup complete!');
  console.log('   - User credentials: carlos.rodriguez@crm.com / Carlos2026!');
  console.log('   - Role: Technician');
  console.log('   - Can self-assign work orders');
  console.log('   - Can view and update their assigned work orders');
  console.log('   - CANNOT assign/reassign other technicians (admin only)\n');

  process.exit(0);
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});