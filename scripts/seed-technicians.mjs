import { MongoClient, ObjectId } from 'mongodb';

const uri = 'mongodb+srv://kriquelme10_db_user:sUBCG6imJ3gcRzCI@cluster0.1grzrfe.mongodb.net/CRM2026?appName=Cluster0';

const client = new MongoClient(uri);

async function seed() {
  await client.connect();
  const db = client.db();
  
  const tenantId = new ObjectId('67f0a1b2c9e77a0012345678');
  const userId = new ObjectId('67f0a1b2c9e77a0012345678');
  
  const technicians = [
    { tenantId, userId: null, name: 'Juan Pérez', email: 'juan@crm.com', phone: '+54 9 11 1234-5678', specialties: ['refrigeración', 'electricidad'], zones: ['CABA Norte', 'CABA Oeste'], status: 'active', availability: 'available', maxDailyWorkOrders: 6, createdBy: userId, updatedBy: userId, deletedAt: null, createdAt: new Date(), updatedAt: new Date() },
    { tenantId, userId: null, name: 'María González', email: 'maria@crm.com', phone: '+54 9 11 2345-6789', specialties: ['gas', 'calderas'], zones: ['CABA Sur', 'La Plata'], status: 'active', availability: 'busy', maxDailyWorkOrders: 5, createdBy: userId, updatedBy: userId, deletedAt: null, createdAt: new Date(), updatedAt: new Date() },
    { tenantId, userId: null, name: 'Carlos Rodríguez', email: 'carlos@crm.com', phone: '+54 9 11 3456-7890', specialties: ['aire acondicionado', 'refrigeración'], zones: ['GBA Norte', 'GBA Este'], status: 'active', availability: 'available', maxDailyWorkOrders: 7, createdBy: userId, updatedBy: userId, deletedAt: null, createdAt: new Date(), updatedAt: new Date() },
    { tenantId, userId: null, name: 'Ana López', email: 'ana@crm.com', phone: '+54 9 11 4567-8901', specialties: ['electricidad', 'automatización'], zones: ['CABA Centro'], status: 'active', availability: 'available', maxDailyWorkOrders: 5, createdBy: userId, updatedBy: userId, deletedAt: null, createdAt: new Date(), updatedAt: new Date() },
    { tenantId, userId: null, name: 'Pedro Martínez', email: 'pedro@crm.com', phone: '+54 9 11 5678-9012', specialties: ['refrigeración', 'montaje'], zones: ['GBA Oeste', 'CABA Sur'], status: 'active', availability: 'unavailable', maxDailyWorkOrders: 4, createdBy: userId, updatedBy: userId, deletedAt: null, createdAt: new Date(), updatedAt: new Date() },
  ];

  await db.collection('technicians').deleteMany({ tenantId });
  await db.collection('technicians').insertMany(technicians);
  
  console.log('✅ Created 5 technicians:');
  await db.collection('technicians').find({ tenantId }).forEach(t => console.log('  -', t.name, '|', t.availability));
  
  await client.close();
}

seed().catch(e => { console.error(e); process.exit(1); });