import mongoose from 'mongoose';

const MONGO_URI = 'mongodb+srv://kriquelme10_db_user:sUBCG6imJ3gcRzCI@cluster0.1grzrfe.mongodb.net/test?appName=Cluster0';

async function main() {
  await mongoose.connect(MONGO_URI);
  
  // Get latest messages
  const latest = await mongoose.connection.collection('whatsappmessages')
    .find({ phone: '5492995095230' })
    .sort({ createdAt: -1 })
    .limit(5)
    .toArray();
  
  console.log('Latest messages:');
  latest.forEach(m => {
    console.log(`- ${m.createdAt}: ${m.content?.substring(0, 30)} | status: ${m.status} | direction: ${m.direction}`);
  });
  
  await mongoose.disconnect();
}

main().catch(console.error);
