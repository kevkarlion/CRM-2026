import mongoose from 'mongoose';

const MONGO_URI = 'mongodb+srv://kriquelme10_db_user:sUBCG6imJ3gcRzCI@cluster0.1grzrfe.mongodb.net/test?appName=Cluster0';

async function main() {
  await mongoose.connect(MONGO_URI);
  
  const db = mongoose.connection.db;
  
  const phone = '5492984252859';
  
  console.log('=== Todas las conversaciones para', phone, '===\n');
  
  // Buscar TODAS las conversaciones con este teléfono
  const convs = await db.collection('conversations').find({
    phoneNumber: { $regex: phone }
  }).toArray();
  
  console.log('Total conversaciones:', convs.length);
  convs.forEach(c => {
    console.log(`  - id: ${c._id}`);
    console.log(`    lifecycleState: ${c.lifecycleState}`);
    console.log(`    conversationType: ${c.conversationType}`);
    console.log(`    owner: ${c.owner}`);
    console.log(`    phoneNumber: ${c.phoneNumber}`);
    console.log(`    leadId: ${c.leadId}`);
    console.log('');
  });
  
  await mongoose.disconnect();
}

main();
