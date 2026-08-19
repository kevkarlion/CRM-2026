import mongoose from 'mongoose';

const MONGO_URI = 'mongodb+srv://kriquelme10_db_user:sUBCG6imJ3gcRzCI@cluster0.1grzrfe.mongodb.net/test?appName=Cluster0';

async function main() {
  await mongoose.connect(MONGO_URI);
  
  const phone = '5492995095230';
  const leadId = '6a7f7491eb4aa6e8755905c4';
  const clientId = '6a7f795ae8c06d937f37d66b';
  
  // Try direct query
  const count = await mongoose.connection.collection('gestiones').countDocuments();
  console.log('Total gestions:', count);
  
  // Query by leadId
  const g1 = await mongoose.connection.collection('gestiones').find({ 
    leadId: mongoose.Types.ObjectId.createFromHexString(leadId) 
  }).limit(5).toArray();
  console.log('By leadId:', g1.length);
  
  // Query by clientId  
  const g2 = await mongoose.connection.collection('gestiones').find({ 
    clientId: mongoose.Types.ObjectId.createFromHexString(clientId) 
  }).limit(5).toArray();
  console.log('By clientId:', g2.length);
  
  // Query by phone
  const g3 = await mongoose.connection.collection('gestiones').find({ phone }).limit(5).toArray();
  console.log('By phone:', g3.length);
  
  // Get a sample to see structure
  const sample = await mongoose.connection.collection('gestiones').findOne({});
  console.log('Sample keys:', sample ? Object.keys(sample) : 'none');
  
  await mongoose.disconnect();
}

main().catch(console.error);
