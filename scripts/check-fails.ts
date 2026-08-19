import mongoose from 'mongoose';

const MONGO_URI = 'mongodb+srv://kriquelme10_db_user:sUBCG6imJ3gcRzCI@cluster0.1grzrfe.mongodb.net/test?appName=Cluster0';

async function main() {
  await mongoose.connect(MONGO_URI);
  
  // Check if other outbound messages to other numbers work
  const otherFails = await mongoose.connection.collection('whatsappmessages')
    .find({ 
      direction: 'outbound', 
      status: 'failed',
      createdAt: { $gt: new Date('2026-08-19T17:00:00') }
    })
    .limit(20)
    .toArray();
  
  console.log('Recent failed messages:', otherFails.length);
  const byPhone = otherFails.reduce((acc, m) => {
    acc[m.phone] = (acc[m.phone] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  console.log('By phone:', byPhone);
  
  // Check if there are ANY successful outbound messages to this number
  const success = await mongoose.connection.collection('whatsappmessages')
    .find({ phone: '5492995095230', direction: 'outbound', status: { $in: ['delivered', 'sent'] } })
    .toArray();
  console.log('\nSuccessful outbound:', success.length);
  
  await mongoose.disconnect();
}

main().catch(console.error);
