import mongoose from 'mongoose';

const MONGO_URI = 'mongodb+srv://kriquelme10_db_user:sUBCG6imJ3gcRzCI@cluster0.1grzrfe.mongodb.net/test?appName=Cluster0';

async function main() {
  await mongoose.connect(MONGO_URI);
  
  const lead = await mongoose.connection.collection('leads').findOne(
    { _id: new mongoose.Types.ObjectId('6a7f7491eb4aa6e8755905c4') }
  );
  
  console.log('Lead:', JSON.stringify(lead, null, 2));
  
  await mongoose.disconnect();
}

main().catch(console.error);
