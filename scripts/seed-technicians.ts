import { config } from 'dotenv';
config({ path: '.env.local' });

import mongoose from 'mongoose';
const { connectDB } = await import('../src/core/db');

async function seed() {
  await connectDB();

  const db = mongoose.connection.db!;

  // Find the first tenant in the database
  const tenant = await db.collection('tenants').findOne({});
  if (!tenant) {
    console.error('❌ No tenant found in database. Run seed.ts first.');
    process.exit(1);
  }
  const tenantId = tenant._id;
  console.log(`📍 Using tenant: ${tenant.name || tenant.slug} (${tenantId})`);

  const technicians = [
    {
      name: 'Juan Pérez',
      email: 'juan.perez@crm.com',
      phone: '+54 9 11 1234-5678',
      specialties: ['refrigeración', 'electricidad'],
      zones: ['CABA Norte', 'CABA Oeste'],
      availability: 'available',
      maxDailyWorkOrders: 6,
    },
    {
      name: 'María González',
      email: 'maria.gonzalez@crm.com',
      phone: '+54 9 11 2345-6789',
      specialties: ['gas', 'calderas', 'calefacción'],
      zones: ['CABA Sur', 'La Plata'],
      availability: 'busy',
      maxDailyWorkOrders: 5,
    },
    {
      name: 'Carlos Rodríguez',
      email: 'carlos.rodriguez@crm.com',
      phone: '+54 9 11 3456-7890',
      specialties: ['aire acondicionado', 'refrigeración', 'informática'],
      zones: ['GBA Norte', 'GBA Este'],
      availability: 'available',
      maxDailyWorkOrders: 7,
    },
    {
      name: 'Ana López',
      email: 'ana.lopez@crm.com',
      phone: '+54 9 11 4567-8901',
      specialties: ['electricidad', 'automatización', 'domótica'],
      zones: ['CABA Centro', 'CABA Este'],
      availability: 'available',
      maxDailyWorkOrders: 5,
    },
    {
      name: 'Pedro Martínez',
      email: 'pedro.martinez@crm.com',
      phone: '+54 9 11 5678-9012',
      specialties: ['refrigeración', 'montaje', 'desmontaje'],
      zones: ['GBA Oeste', 'CABA Sur'],
      availability: 'unavailable',
      maxDailyWorkOrders: 4,
    },
    {
      name: 'Lucía Fernández',
      email: 'lucia.fernandez@crm.com',
      phone: '+54 9 11 6789-0123',
      specialties: ['gas', 'aire acondicionado', 'reparación'],
      zones: ['CABA Norte', 'GBA Norte', 'Tigre'],
      availability: 'available',
      maxDailyWorkOrders: 6,
    },
    {
      name: 'Diego Sánchez',
      email: 'diego.sanchez@crm.com',
      phone: '+54 9 11 7890-1234',
      specialties: ['electricidad', 'refrigeración', 'plomería'],
      zones: ['CABA Sur', 'La Plata', 'Quilmes'],
      availability: 'available',
      maxDailyWorkOrders: 5,
    },
  ];

  const collection = db.collection('technicians');

  // Clear existing for this tenant
  await collection.deleteMany({ tenantId });
  console.log('🗑️  Cleared existing technicians');

  // Insert one by one to handle unique index on (tenantId, userId)
  let count = 0;
  for (const t of technicians) {
    const userId = new mongoose.Types.ObjectId(); // unique per technician
    await collection.insertOne({
      ...t,
      tenantId,
      userId,
      status: 'active',
      createdBy: tenantId,
      updatedBy: tenantId,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    count++;
  }

  console.log(`✅ Created ${count} technicians:\n`);

  const all = await collection.find({ tenantId }).toArray();
  all.forEach((t: any) => {
    console.log(
      `  ${t.name} | ${t.specialties.join(', ')} | ${t.zones.join(', ')} | ${t.availability}`
    );
  });

  process.exit(0);
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
