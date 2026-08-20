import mongoose from 'mongoose';

const MONGO_URI = 'mongodb+srv://kriquelme10_db_user:sUBCG6imJ3gcRzCI@cluster0.1grzrfe.mongodb.net/test?appName=Cluster0';

async function main() {
  await mongoose.connect(MONGO_URI);
  
  const db = mongoose.connection.db;
  
  const phone = '5492984252859';
  
  console.log('=== Mensajes para', phone, '===\n');
  
  // Últimos mensajes
  const msgs = await db.collection('whatsapp-messages').find({
    phone: { $regex: phone }
  }).sort({ createdAt: -1 }).limit(10).toArray();
  
  console.log('Mensajes total:', msgs.length);
  msgs.forEach(m => {
    console.log(`  ${m.direction} | ${m.content?.substring(0, 40)} | ${m.createdAt}`);
  });
  
  console.log('\n=== Todas las conversaciones para el teléfono ===');
  const allConvs = await db.collection('conversations').find({
    phoneNumber: { $regex: phone }
  }).toArray();
  
  console.log('Conversaciones:', allConvs.length);
  allConvs.forEach(c => {
    console.log(`  - ${c.lifecycleState} | ${c.owner} | ${c.conversationType}`);
  });
  
  await mongoose.disconnect();
}

main();
