import mongoose from 'mongoose';

const MONGO_URI = 'mongodb+srv://kriquelme10_db_user:sUBCG6imJ3gcRzCI@cluster0.1grzrfe.mongodb.net/test?appName=Cluster0';

async function main() {
  await mongoose.connect(MONGO_URI);
  
  // Check messages for this phone
  const msgs = await mongoose.connection.collection('whatsappmessages')
    .find({ phone: '5492995095230' })
    .sort({ createdAt: -1 })
    .limit(10)
    .toArray();
  
  console.log('Messages found:', msgs.length);
  if (msgs.length > 0) {
    console.log(JSON.stringify(msgs.map(m => ({
      _id: m._id,
      status: m.status,
      direction: m.direction,
      content: m.content?.substring(0, 50),
      createdAt: m.createdAt
    })), null, 2));
  }
  
  await mongoose.disconnect();
}

main().catch(console.error);
