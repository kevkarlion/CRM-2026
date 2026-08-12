/**
 * Script para vaciar los datos de la base de datos
 * Mantiene: tenants, usuarios, roles, permisos, catálogos, configuración
 * Borra: leads, clientes, conversaciones, mensajes, quotes, orders, etc.
 */

import mongoose from 'mongoose';

const MONGO_URI = process.env.MONGODB_URI;

if (!MONGO_URI) {
  console.error('❌ Error: No se encontró la variable de entorno MONGODB_URI');
  process.exit(1);
}

const COLLECTIONS_TO_CLEAR = [
  // CRM
  'clients',
  'contacts',
  'locations',
  'equipment',
  'attachments',
  'activities',
  'tasks',
  'whatsapp-messages',
  'service-histories',
  'client-service-histories',
  
  // Leads
  'leads',
  'lead-assignments',
  'pipelines',
  
  // Conversations
  'conversations',
  
  // Quotes
  'quotes',
  'quote-versions',
  'negotiations',
  'negotiation-events',
  
  // Documents
  'documents',
  
  // Operations
  'work-orders',
  'work-order-assignments',
  'work-order-events',
  'technical-visits',
  'pre-visit-checklists',
  'visit-reports',
  'technicians',
  'work-reports',
  
  // Contracts
  'contracts',
  'contract-equipments',
  'maintenance-plans',
  'maintenance-schedules',
  
  // Timeline
  'timeline-events',
  
  // Audit (opcional - normalmente se mantiene)
  // 'activity-logs',
  // 'security-logs',
];

async function clearDatabase() {
  console.log('🔌 Conectando a MongoDB...');
  await mongoose.connect(MONGO_URI);
  console.log('✅ Conectado\n');

  const db = mongoose.connection.db;

  for (const collectionName of COLLECTIONS_TO_CLEAR) {
    try {
      const collection = db.collection(collectionName);
      const result = await collection.deleteMany({});
      console.log(`🗑️  ${collectionName}: ${result.deletedCount} documentos borrados`);
    } catch (error: any) {
      console.log(`⚠️  ${collectionName}: ${error.message}`);
    }
  }

  console.log('\n✅ Base de datos vaciada correctamente');
  
  // Mostrar lo que queda
  console.log('\n📊 Colecciones restantes (configuración):');
  const collections = await db.listCollections().toArray();
  for (const col of collections) {
    const count = await db.collection(col.name).countDocuments();
    console.log(`   - ${col.name}: ${count} documentos`);
  }

  await mongoose.disconnect();
  console.log('\n🔌 Desconectado');
}

clearDatabase().catch(console.error);
