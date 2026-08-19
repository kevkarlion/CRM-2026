import mongoose from 'mongoose';

const MONGO_URI = 'mongodb+srv://kriquelme10_db_user:sUBCG6imJ3gcRzCI@cluster0.1grzrfe.mongodb.net/test?appName=Cluster0';

async function main() {
  await mongoose.connect(MONGO_URI);
  
  // Check gestion by phone or leadId
  const phone = '5492995095230';
  const leadId = '6a7f7491eb4aa6e8755905c4';
  
  const gestions = await mongoose.connection.collection('gestiones').find({
    $or: [
      { leadId: new mongoose.Types.ObjectId(leadId) },
      { clientId: new mongoose.Types.ObjectId('6a7f795ae8c06d937f37d66b') },
      { phone: phone }
    ]
  }).toArray();
  
  console.log('Gestiones:', JSON.stringify(gestions, null, 2));
  
  await mongoose.disconnect();
}

main().catch(console.error);
