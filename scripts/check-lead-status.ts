import mongoose from 'mongoose';

const MONGO_URI = 'mongodb+srv://kriquelme10_db_user:sUBCG6imJ3gcRzCI@cluster0.1grzrfe.mongodb.net/test?appName=Cluster0';

async function main() {
  await mongoose.connect(MONGO_URI);
  
  // Check lead history/status
  const lead = await mongoose.connection.collection('leads').findOne(
    { _id: new mongoose.Types.ObjectId('6a7f7491eb4aa6e8755905c4') }
  );
  
  console.log('Current status:', lead?.status);
  console.log('isClient:', lead?.isClient);
  console.log('clientId:', lead?.clientId);
  console.log('convertedToClient:', lead?.convertedToClient);
  console.log('convertedAt:', lead?.convertedAt);
  console.log('resolvedAt:', lead?.resolvedAt);
  console.log('deletedAt:', lead?.deletedAt);
  
  // Check all statuses this lead has had (if tracked)
  console.log('\n=== Check if lead was ever closed ===');
  
  await mongoose.disconnect();
}

main().catch(console.error);
