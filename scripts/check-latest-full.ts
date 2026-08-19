import mongoose from 'mongoose';

const MONGO_URI = 'mongodb+srv://kriquelme10_db_user:sUBCG6imJ3gcRzCI@cluster0.1grzrfe.mongodb.net/test?appName=Cluster0';

async function main() {
  await mongoose.connect(MONGO_URI);
  
  // Get message with full error details
  const msg = await mongoose.connection.collection('whatsappmessages')
    .find({ phone: '5492995095230', content: /Buenas tardes/ })
    .sort({ createdAt: -1 })
    .limit(1)
    .next();
  
  console.log('Full message doc:');
  console.log(JSON.stringify(msg, null, 2));
  
  await mongoose.disconnect();
}

main().catch(console.error);
