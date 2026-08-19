import mongoose from 'mongoose';

const MONGO_URI = 'mongodb+srv://kriquelme10_db_user:sUBCG6imJ3gcRzCI@cluster0.1grzrfe.mongodb.net/test?appName=Cluster0';

async function main() {
  await mongoose.connect(MONGO_URI);
  
  const leadId = '6a7f7491eb4aa6e8755905c4';
  const clientId = '6a7f795ae8c06d937f37d66b';
  const phone = '5492995095230';
  
  // Try different field names
  const gestiones = await mongoose.connection.collection('gestiones').find({
    $or: [
      { leadId: new mongoose.Types.ObjectId(leadId) },
      { 'lead._id': new mongoose.Types.ObjectId(leadId) },
      { clientId: new mongoose.Types.ObjectId(clientId) },
      { 'client._id': new mongoose.Types.ObjectId(clientId) },
      { phone: phone },
      { 'contact.phone': phone }
    ]
  }).toArray();
  
  console.log('Gestiones:', JSON.stringify(gestiones, null, 2));
  
  // Also check what fields exist in gestion collection
  const sample = await mongoose.connection.collection('gestiones').findOne({});
  console.log('Sample fields:', Object.keys(sample || {}));
  
  await mongoose.disconnect();
}

main().catch(console.error);
