import mongoose from 'mongoose';

const MONGO_URI = 'mongodb+srv://kriquelme10_db_user:sUBCG6imJ3gcRzCI@cluster0.1grzrfe.mongodb.net/test?appName=Cluster0';

async function main() {
  await mongoose.connect(MONGO_URI);
  
  const leadId = '6a7f7491eb4aa6e8755905c4';
  
  const result = await mongoose.connection.collection('leads').updateOne(
    { _id: new mongoose.Types.ObjectId(leadId) },
    { $set: { convertedToClient: null, clientId: null } }
  );
  
  console.log('Modified:', result.modifiedCount);
  
  const lead = await mongoose.connection.collection('leads').findOne(
    { _id: new mongoose.Types.ObjectId(leadId) }
  );
  
  console.log('status:', lead?.status);
  console.log('clientId:', lead?.clientId);
  console.log('convertedToClient:', lead?.convertedToClient);
  
  await mongoose.disconnect();
}

main().catch(console.error);
