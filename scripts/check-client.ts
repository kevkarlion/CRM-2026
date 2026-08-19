import mongoose from 'mongoose';

const MONGO_URI = 'mongodb+srv://kriquelme10_db_user:sUBCG6imJ3gcRzCI@cluster0.1grzrfe.mongodb.net/test?appName=Cluster0';

async function main() {
  await mongoose.connect(MONGO_URI);
  
  // Check for client with this phone
  const client = await mongoose.connection.collection('clients').findOne(
    { phone: '5492995095230' }
  );
  
  console.log('Client:', JSON.stringify(client, null, 2));
  
  await mongoose.disconnect();
}

main().catch(console.error);
