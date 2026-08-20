import mongoose from 'mongoose';

const MONGO_URI = 'mongodb+srv://kriquelme10_db_user:sUBCG6imJ3gcRzCI@cluster0.1grzrfe.mongodb.net/test?appName=Cluster0';

async function main() {
  await mongoose.connect(MONGO_URI);
  
  const db = mongoose.connection.db;
  const clientId = '6a86e86fff23c9b06f3c7722';
  
  console.log('=== CLIENTE', clientId, '===\n');
  
  const client = await db.collection('clients').findOne({ 
    _id: new mongoose.Types.ObjectId(clientId) 
  });
  
  if (!client) {
    console.log('Cliente no encontrado');
    await mongoose.disconnect();
    return;
  }
  
  console.log('CLIENT:');
  console.log('  - name:', client.fullName);
  console.log('  - company:', client.companyName);
  console.log('  - phone:', client.phone);
  console.log('  - status:', client.status);
  console.log('  - operationStatus:', client.operationStatus);
  console.log('  - temperature:', client.temperature);
  console.log('  - score:', client.score);
  
  // Buscar lead(s) con mismo teléfono
  if (client.phone) {
    const phone = client.phone.replace(/\D/g, '');
    console.log('\n=== LEADS con teléfono', phone, '===');
    
    const leads = await db.collection('leads').find({
      phone: { $regex: phone },
      deletedAt: null
    }).toArray();
    
    leads.forEach(l => {
      console.log(`  - name: ${l.name} | status: ${l.status}`);
    });
    
    // Buscar Gestiones por clientId
    console.log('\n=== GESTIONES (por clientId) ===');
    const gestions = await db.collection('gestiones').find({
      clientId: client._id,
      deletedAt: null
    }).toArray();
    
    console.log('Gestiones:', gestions.length);
    gestions.forEach(g => {
      console.log(`  - name: ${g.name} | status: ${g.status}`);
    });
    
    // Buscar conversaciones con este teléfono
    console.log('\n=== CONVERSACIONES ===');
    const convs = await db.collection('conversations').find({
      phoneNumber: { $regex: phone }
    }).toArray();
    
    console.log('Conversaciones:', convs.length);
    convs.forEach(c => {
      console.log(`  - state: ${c.lifecycleState} | owner: ${c.owner} | type: ${c.conversationType} | lastMsg: ${c.lastMessageAt}`);
    });
    
    // Buscar mensajes
    console.log('\n=== MENSAJES ===');
    const msgs = await db.collection('whatsapp-messages').find({
      phone: { $regex: phone }
    }).sort({ createdAt: -1 }).limit(10).toArray();
    
    console.log('Mensajes:', msgs.length);
    msgs.forEach(m => {
      console.log(`  ${m.direction} | ${m.content?.substring(0, 50)} | ${m.createdAt}`);
    });
  }
  
  await mongoose.disconnect();
}

main();
