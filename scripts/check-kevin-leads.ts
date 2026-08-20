import mongoose from 'mongoose';

const MONGO_URI = 'mongodb+srv://kriquelme10_db_user:sUBCG6imJ3gcRzCI@cluster0.1grzrfe.mongodb.net/test?appName=Cluster0';

async function main() {
  await mongoose.connect(MONGO_URI);
  
  const db = mongoose.connection.db;
  
  const phone = '5492984252859';
  
  console.log('=== Buscando conversaciones para', phone, '===\n');
  
  // Buscar TODAS las conversaciones (sin filtro de phoneNumber)
  // Buscar por leadId en cambio
  const leads = await db.collection('leads').find({
    phone: { $regex: phone },
    deletedAt: null
  }).toArray();
  
  console.log('Leads con este teléfono:');
  leads.forEach(l => {
    console.log(`  - ${l.name} | _id: ${l._id} | status: ${l.status}`);
  });
  
  // Buscar conversaciones por leadId
  for (const lead of leads) {
    console.log(`\n=== Conversaciones para lead ${lead.name} (${lead._id}) ===`);
    
    const convs = await db.collection('conversations').find({
      leadId: lead._id
    }).toArray();
    
    console.log('Conversaciones:', convs.length);
    convs.forEach(c => {
      console.log(`  - state: ${c.lifecycleState} | type: ${c.conversationType} | phone: ${c.phoneNumber} | owner: ${c.owner}`);
    });
  }
  
  await mongoose.disconnect();
}

main();
