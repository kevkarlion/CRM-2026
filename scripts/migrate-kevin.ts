import mongoose from 'mongoose';

const MONGO_URI = 'mongodb+srv://kriquelme10_db_user:sUBCG6imJ3gcRzCI@cluster0.1grzrfe.mongodb.net/test?appName=Cluster0';

async function main() {
  await mongoose.connect(MONGO_URI);
  
  const db = mongoose.connection.db;
  
  // Kevin - 5492984252859
  const phone = '5492984252859';
  
  console.log('=== Migrando conversación de Kevin ===\n');
  
  // 1. Buscar conversaciones de Kevin (por leadId)
  const leads = await db.collection('leads').find({
    phone: { $regex: phone },
    deletedAt: null
  }).toArray();
  
  console.log('Leads encontrados:');
  leads.forEach(l => console.log(`  - ${l.name} | _id: ${l._id} | status: ${l.status}`));
  
  // 2. Migrar conversaciones de lead -> customer
  let migrated = 0;
  for (const lead of leads) {
    const result = await db.collection('conversations').updateMany(
      { leadId: lead._id, conversationType: 'lead' },
      {
        $set: {
          conversationType: 'customer',
          phoneNumber: lead.phone,
          lifecycleState: 'ACTIVE_CLIENT', // Cambiar a estado de cliente
        }
      }
    );
    
    if (result.modifiedCount > 0) {
      console.log(`\n✅ Migradas ${result.modifiedCount} conversación(es) del lead ${lead.name}`);
      migrated += result.modifiedCount;
    }
  }
  
  // 3. Verificar resultado
  console.log('\n=== Verificando después de migración ===');
  const convsAfter = await db.collection('conversations').find({
    $or: [
      { phoneNumber: { $regex: phone } },
      { leadId: { $in: leads.map(l => l._id) } }
    ]
  }).toArray();
  
  console.log('\nConversaciones actuales:');
  convsAfter.forEach(c => {
    console.log(`  - id: ${c._id}`);
    console.log(`    type: ${c.conversationType}`);
    console.log(`    state: ${c.lifecycleState}`);
    console.log(`    phone: ${c.phoneNumber}`);
    console.log(`    leadId: ${c.leadId}`);
    console.log('');
  });
  
  console.log(`\nTotal migradas: ${migrated}`);
  
  await mongoose.disconnect();
}

main();
