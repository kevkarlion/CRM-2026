import { connectDB } from './src/core/db';
import mongoose from 'mongoose';

async function seed() {
  await connectDB();
  
  const tenantId = '67f0a1b2c9e77a0012345678';
  const userId = '67f0a1b2c9e77a0012345678';
  
  const technicians = [
    { name: 'Juan Pérez', email: 'juan@crm.com', phone: '+54 9 11 1234-5678', specialties: ['refrigeración', 'electricidad'], zones: ['CABA Norte', 'CABA Oeste'], maxDailyWorkOrders: 6 },
    { name: 'María González', email: 'maria@crm.com', phone: '+54 9 11 2345-6789', specialties: ['gas', 'calderas'], zones: ['CABA Sur', 'La Plata'], maxDailyWorkOrders: 5 },
    { name: 'Carlos Rodríguez', email: 'carlos@crm.com', phone: '+54 9 11 3456-7890', specialties: ['aire acondicionado', 'refrigeración'], zones: ['GBA Norte', 'GBA Este'], maxDailyWorkOrders: 7 },
    { name: 'Ana López', email: 'ana@crm.com', phone: '+54 9 11 4567-8901', specialties: ['electricidad', 'automatización'], zones: ['CABA Centro'], maxDailyWorkOrders: 5 },
    { name: 'Pedro Martínez', email: 'pedro@crm.com', phone: '+54 9 11 5678-9012', specialties: ['refrigeración', 'montaje'], zones: ['GBA Oeste', 'CABA Sur'], maxDailyWorkOrders: 4 },
  ];

  // Clear existing
  const { Technician } = await import('./src/operations/models/technician');
  await Technician.deleteMany({ tenantId: new mongoose.Types.ObjectId(tenantId) });
  
  // Insert with proper ObjectIds
  const { TechnicianModel } = await import('./src/operations/models');
  const result = await TechnicianModel.insertMany(technicians.map(t => ({
    ...t,
    tenantId: new mongoose.Types.ObjectId(tenantId),
    userId: null,
    status: 'active',
    availability: ['available', 'busy', 'available', 'available', 'unavailable'],
    createdBy: new mongoose.Types.ObjectId(userId),
    updatedBy: new mongoose.Types.ObjectId(userId),
  })));
  
  console.log('✅ Created', result.length, 'technicians');
  result.forEach((t: any) => console.log('  -', t.name, '|', t.availability));
  
  process.exit(0);
}

seed().catch(e => { console.error(e); process.exit(1); });