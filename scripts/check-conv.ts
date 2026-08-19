import mongoose from 'mongoose';

const MONGO_URI = 'mongodb+srv://kriquelme10_db_user:sUBCG6imJ3gcRzCI@cluster0.1grzrfe.mongodb.net/test?appName=Cluster0';

async function main() {
  await mongoose.connect(MONGO_URI);
  
  // Check all conversations for this phone
  const conversations = await mongoose.connection.collection('conversations')
    .find({ phoneNumber: '5492995095230' })
    .toArray();
  
  console.log('Total conversations:', conversations.length);
  conversations.forEach(c => {
    console.log('\n--- Conversation ---');
    console.log('ID:', c._id);
    console.log('Type:', c.conversationType);
    console.log('State:', c.lifecycleState);
    console.log('Owner:', c.owner);
    console.log('LeadId:', c.leadId);
    console.log('ClientId:', c.clientId);
    console.log('FlowType:', c.flowType);
    console.log('Created:', c.createdAt);
  });
  
  await mongoose.disconnect();
}

main().catch(console.error);
