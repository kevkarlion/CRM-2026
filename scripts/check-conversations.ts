import mongoose from 'mongoose';

const MONGO_URI = 'mongodb+srv://kriquelme10_db_user:sUBCG6imJ3gcRzCI@cluster0.1grzrfe.mongodb.net/test?appName=Cluster0';

async function main() {
  await mongoose.connect(MONGO_URI);
  
  // Check conversations for this phone
  const conversations = await mongoose.connection.collection('conversations').find(
    { phone: '5492995095230' }
  ).toArray();
  
  console.log('Conversations:', JSON.stringify(conversations, null, 2));
  
  await mongoose.disconnect();
}

main().catch(console.error);
