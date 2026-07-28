import { config } from 'dotenv';
config({ path: '.env.local' });

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

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

  // Find the technician role
  const technicianRole = await db.collection('roles').findOne({ name: 'technician', tenantId });
  if (!technicianRole) {
    console.error('❌ Technician role not found. Run seed.ts first.');
    process.exit(1);
  }
  console.log(`🔧 Role: ${technicianRole.name} (${technicianRole._id})`);

  // Check if user already exists
  const email = 'carlos.rodriguez@crm.com';
  const existingUser = await db.collection('users').findOne({ email, tenantId, deletedAt: null });
  
  if (existingUser) {
    console.log(`⚠️  User ${email} already exists. Updating...`);
    
    // Update existing user
    await db.collection('users').updateOne(
      { _id: existingUser._id },
      { 
        $set: { 
          passwordHash: await bcrypt.hash('Carlos2026!', 10),
          firstName: 'Carlos',
          lastName: 'Rodríguez',
          status: 'active',
          updatedAt: new Date(),
        } 
      }
    );
    console.log('✅ User updated.');
  } else {
    // Create new user
    const userId = new mongoose.Types.ObjectId();
    await db.collection('users').insertOne({
      tenantId,
      email,
      passwordHash: await bcrypt.hash('Carlos2026!', 10),
      firstName: 'Carlos',
      lastName: 'Rodríguez',
      status: 'active',
      lastLoginAt: null,
      passwordChangedAt: null,
      failedLoginAttempts: 0,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log(`✅ User created: ${email}`);
  }

  // Get user
  const user = await db.collection('users').findOne({ email, tenantId, deletedAt: null });
  if (!user) {
    console.error('❌ Failed to get user');
    process.exit(1);
  }

  // Check if user role already exists
  const existingUserRole = await db.collection('userroles').findOne({ 
    userId: user._id, 
    tenantId, 
    deletedAt: null 
  });

  if (existingUserRole) {
    console.log('⚠️  User already has a role assigned.');
  } else {
    // Assign technician role
    await db.collection('userroles').insertOne({
      tenantId,
      userId: user._id,
      roleId: technicianRole._id,
      assignedBy: tenantId,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log('✅ Technician role assigned.');
  }

  console.log('\n🎉 Carlos Rodríguez credentials created!');
  console.log('   Email: carlos.rodriguez@crm.com');
  console.log('   Password: Carlos2026!');
  console.log('   Role: Technician\n');

  process.exit(0);
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});