import mongoose from 'mongoose';

const MONGO_URI = 'mongodb+srv://kriquelme10_db_user:sUBCG6imJ3gcRzCI@cluster0.1grzrfe.mongodb.net/test?appName=Cluster0';

async function main() {
  await mongoose.connect(MONGO_URI);
  
  const db = mongoose.connection.db;
  
  console.log('=== Buscando a Kevin ===\n');
  
  // Buscar cliente Kevin
  const client = await db.collection('clients').findOne({
    $or: [
      { fullName: { $regex: /kevin/i } },
      { companyName: { $regex: /kevin/i } }
    ],
    deletedAt: null
  });
  
  if (client) {
    console.log('CLIENT:');
    console.log('  - name:', client.fullName);
    console.log('  - company:', client.companyName);
    console.log('  - phone:', client.phone);
    console.log('  - status:', client.status);
  } else {
    console.log('Cliente Kevin NO encontrado');
  }
  
  // Buscar conversaciones de Kevin (por teléfono si tiene)
  if (client?.phone) {
    const phone = client.phone.replace(/\D/g, '');
    console.log('\n=== Conversaciones para', phone, '===');
    
    const convs = await db.collection('conversations').find({
      phoneNumber: { $regex: phone }
    }).sort({ lastMessageAt: -1 }).limit(5).toArray();
    
    console.log('Conversaciones:', convs.length);
    convs.forEach(c => {
      console.log(`  - state: ${c.lifecycleState} | owner: ${c.owner} | type: ${c.conversationType}`);
    });
    
    // Últimos mensajes
    console.log('\n=== Últimos mensajes (inbound) ===');
    const msgs = await db.collection('whatsapp-messages').find({
      phone: { $regex: phone },
      direction: 'inbound'
    }).sort({ createdAt: -1 }).limit(3).toArray();
    
    msgs.forEach(m => {
      console.log(`  - ${m.content?.substring(0, 50)} | createdAt: ${m.createdAt}`);
    });
  }
  
  await mongoose.disconnect();
}

main();
