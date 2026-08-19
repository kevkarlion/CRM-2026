import mongoose from 'mongoose';

const MONGO_URI = 'mongodb+srv://kriquelme10_db_user:sUBCG6imJ3gcRzCI@cluster0.1grzrfe.mongodb.net/crm2026?appName=Cluster0';

async function main() {
  await mongoose.connect(MONGO_URI);
  
  // Check lead phone format
  const lead = await mongoose.connection.collection('leads').findOne(
    { _id: new mongoose.Types.ObjectId('6a7f7491eb4aa6e8755905c4') }
  );
  console.log('Lead phone:', lead?.phone);
  console.log('Phone length:', lead?.phone?.length);
  
  // Check messages for this phone
  const msgs = await mongoose.connection.collection('whatsappmessages')
    .find({ phone: '5492995095230' })
    .sort({ createdAt: -1 })
    .limit(5)
    .toArray();
  
  console.log('Recent messages:', JSON.stringify(msgs.map(m => ({
    _id: m._id,
    status: m.status,
    direction: m.direction,
    createdAt: m.createdAt
  })), null, 2));
  
  await mongoose.disconnect();
}

main().catch(console.error);
