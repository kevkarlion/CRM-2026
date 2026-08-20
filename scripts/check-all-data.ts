import mongoose from 'mongoose';

const MONGO_URI = 'mongodb+srv://kriquelme10_db_user:sUBCG6imJ3gcRzCI@cluster0.1grzrfe.mongodb.net/test?appName=Cluster0';

async function main() {
  await mongoose.connect(MONGO_URI);
  
  const db = mongoose.connection.db;
  
  console.log('=== TODOS los mensajes (últimos 10) ===\n');
  
  const msgs = await db.collection('whatsapp-messages').find({})
    .sort({ createdAt: -1 })
    .limit(10)
    .toArray();
  
  console.log('Total en DB:', msgs.length);
  msgs.forEach(m => {
    console.log(`  phone: ${m.phone} | direction: ${m.direction} | leadId: ${m.leadId} | content: ${m.content?.substring(0, 30)}`);
  });
  
  console.log('\n=== LEADS más recientes ===\n');
  
  const leads = await db.collection('leads').find({ deletedAt: null })
    .sort({ createdAt: -1 })
    .limit(5)
    .toArray();
  
  leads.forEach(l => {
    console.log(`  ${l.name} | phone: ${l.phone} | status: ${l.status} | _id: ${l._id}`);
  });
  
  await mongoose.disconnect();
}

main();
