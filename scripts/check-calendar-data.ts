import { config } from 'dotenv';
config({ path: '.env.local' });

import mongoose from 'mongoose';

async function checkData() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/crm-2026';
  await mongoose.connect(uri);
  
  const db = mongoose.connection.db!;
  
  const tenant = await db.collection('tenants').findOne({});
  if (!tenant) {
    console.log('❌ No tenant found');
    process.exit(1);
  }
  const tenantId = tenant._id;
  
  console.log('📊 Checking data for tenant:', tenant.name);
  
  // Check work orders
  const totalWO = await db.collection('workorders').countDocuments({ tenantId, deletedAt: null });
  const withScheduledDate = await db.collection('workorders').countDocuments({ 
    tenantId, 
    deletedAt: null,
    scheduledDate: { $exists: true, $ne: null }
  });
  
  console.log('\n📋 Work Orders:');
  console.log('   Total:', totalWO);
  console.log('   With scheduledDate:', withScheduledDate);
  
  // Show some work orders
  const sampleWO = await db.collection('workorders')
    .find({ tenantId, deletedAt: null, scheduledDate: { $exists: true, $ne: null } })
    .limit(3)
    .toArray();
  
  sampleWO.forEach(wo => {
    console.log(`   - ${wo.workOrderNumber}: ${wo.title} | scheduledDate: ${wo.scheduledDate} | status: ${wo.status}`);
  });
  
  // Check technical visits
  const totalTV = await db.collection('technicalvisits').countDocuments({ tenantId, deletedAt: null });
  const tvWithScheduledDate = await db.collection('technicalvisits').countDocuments({ 
    tenantId, 
    deletedAt: null,
    scheduledDate: { $exists: true, $ne: null }
  });
  
  console.log('\n🔧 Technical Visits:');
  console.log('   Total:', totalTV);
  console.log('   With scheduledDate:', tvWithScheduledDate);
  
  // Show some visits
  const sampleTV = await db.collection('technicalvisits')
    .find({ tenantId, deletedAt: null, scheduledDate: { $exists: true, $ne: null } })
    .limit(3)
    .toArray();
  
  sampleTV.forEach(tv => {
    console.log(`   - ${tv.visitNumber}: ${tv.title} | scheduledDate: ${tv.scheduledDate} | status: ${tv.status}`);
  });
  
  // Check Carlos's assignments
  const technician = await db.collection('technicians').findOne({ email: 'carlos.rodriguez@crm.com', tenantId });
  if (technician) {
    console.log('\n👤 Carlos Rodríguez technician ID:', technician._id);
    
    const carlosWO = await db.collection('workorders').countDocuments({
      tenantId,
      assignedTechnicians: technician._id,
      deletedAt: null
    });
    console.log('   Work Orders assigned:', carlosWO);
    
    const carlosTV = await db.collection('technicalvisits').countDocuments({
      tenantId,
      assignedTechnicianId: technician._id,
      deletedAt: null
    });
    console.log('   Technical Visits assigned:', carlosTV);
  }
  
  await mongoose.disconnect();
  console.log('\n✅ Done');
}

checkData().catch(console.error);