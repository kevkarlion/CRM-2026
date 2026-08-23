import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/crm2026';

async function main() {
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;
  
  // Update customer conversations in idle to greeting_personalized
  const result = await db.collection('conversations').updateMany(
    { conversationType: 'customer', state: 'idle' },
    { $set: { state: 'greeting_personalized' } }
  );
  
  console.log('Updated customer conversations from idle to greeting_personalized:', result.modifiedCount);
  
  // Also check what we have now
  const convos = await db.collection('conversations').find({ 
    phoneNumber: '5492984252859'
  }).toArray();
  
  console.log('\nConversations for Kevin:');
  for (const c of convos) {
    console.log('  - _id:', c._id);
    console.log('    state:', c.state);
    console.log('    conversationType:', c.conversationType);
    console.log('    clientId:', c.clientId);
    console.log('    leadId:', c.leadId);
    console.log('');
  }
  
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
