import mongoose from 'mongoose';

const MONGO_URI = 'mongodb+srv://kriquelme10_db_user:sUBCG6imJ3gcRzCI@cluster0.1grzrfe.mongodb.net/test?appName=Cluster0';

async function main() {
  await mongoose.connect(MONGO_URI);
  
  const db = mongoose.connection.db;
  
  console.log('=== Últimos mensajes en la DB ===\n');
  
  // Últimos 20 mensajes
  const msgs = await db.collection('whatsapp-messages').find({})
    .sort({ createdAt: -1 })
    .limit(20)
    .toArray();
  
  console.log('Total mensajes:', msgs.length);
  msgs.forEach(m => {
    console.log(`  ${m.phone} | ${m.direction} | ${m.content?.substring(0, 30)} | ${m.createdAt}`);
  });
  
  console.log('\n=== Últimas conversaciones ===\n');
  
  const convs = await db.collection('conversations').find({})
    .sort({ lastMessageAt: -1 })
    .limit(10)
    .toArray();
  
  convs.forEach(c => {
    console.log(`  ${c.phoneNumber} | ${c.lifecycleState} | ${c.conversationType}`);
  });
  
  await mongoose.disconnect();
}

main();
