import mongoose from 'mongoose';

const MONGO_URI = 'mongodb+srv://kriquelme10_db_user:sUBCG6imJ3gcRzCI@cluster0.1grzrfe.mongodb.net/test?appName=Cluster0';

async function main() {
  await mongoose.connect(MONGO_URI);
  
  // Delete customer conversation
  const result = await mongoose.connection.collection('conversations').deleteMany({
    phoneNumber: '5492995095230',
    conversationType: 'customer'
  });
  
  console.log('Deleted customer conversations:', result.deletedCount);
  
  // Check remaining conversations
  const remaining = await mongoose.connection.collection('conversations')
    .find({ phoneNumber: '5492995095230' })
    .toArray();
  
  console.log('Remaining conversations:', remaining.length);
  remaining.forEach(c => {
    console.log('- Type:', c.conversationType, 'State:', c.lifecycleState, 'Owner:', c.owner);
  });
  
  await mongoose.disconnect();
}

main().catch(console.error);
