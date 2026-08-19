import mongoose from 'mongoose';

const MONGO_URI = 'mongodb+srv://kriquelme10_db_user:sUBCG6imJ3gcRzCI@cluster0.1grzrfe.mongodb.net/test?appName=Cluster0';

async function main() {
  await mongoose.connect(MONGO_URI);
  
  // Get successful outbound messages to this number
  const success = await mongoose.connection.collection('whatsappmessages')
    .find({ phone: '5492995095230', direction: 'outbound', status: { $in: ['delivered', 'sent'] } })
    .sort({ createdAt: -1 })
    .toArray();
  
  console.log('Successful outbound messages:');
  success.forEach(m => {
    console.log(`- ${m.createdAt}: ${m.content?.substring(0, 30)} | status: ${m.status}`);
  });
  
  await mongoose.disconnect();
}

main().catch(console.error);
