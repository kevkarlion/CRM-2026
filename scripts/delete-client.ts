import mongoose from 'mongoose';

const MONGO_URI = 'mongodb+srv://kriquelme10_db_user:sUBCG6imJ3gcRzCI@cluster0.1grzrfe.mongodb.net/test?appName=Cluster0';

async function main() {
  await mongoose.connect(MONGO_URI);
  
  // Delete the client
  const result = await mongoose.connection.collection('clients').deleteOne({
    _id: new mongoose.Types.ObjectId('6a7f795ae8c06d937f37d66b')
  });
  
  console.log('Deleted client:', result.deletedCount);
  
  // Verify
  const clients = await mongoose.connection.collection('clients')
    .find({ phone: '5492995095230' })
    .toArray();
  
  console.log('Remaining clients:', clients.length);
  
  await mongoose.disconnect();
}

main().catch(console.error);
