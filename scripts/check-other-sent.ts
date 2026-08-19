import mongoose from 'mongoose';

const MONGO_URI = 'mongodb+srv://kriquelme10_db_user:sUBCG6imJ3gcRzCI@cluster0.1grzrfe.mongodb.net/test?appName=Cluster0';

async function main() {
  await mongoose.connect(MONGO_URI);
  
  // Check outbound messages after Aug 14 for other phones
  const otherPhones = await mongoose.connection.collection('whatsappmessages')
    .find({ 
      direction: 'outbound', 
      status: { $in: ['delivered', 'sent'] },
      createdAt: { $gt: new Date('2026-08-15') }
    })
    .sort({ createdAt: -1 })
    .limit(10)
    .toArray();
  
  console.log('Sent/Delivered after Aug 15:');
  otherPhones.forEach(m => {
    console.log(`- ${m.createdAt}: ${m.phone} | ${m.content?.substring(0, 30)} | status: ${m.status}`);
  });
  
  await mongoose.disconnect();
}

main().catch(console.error);
