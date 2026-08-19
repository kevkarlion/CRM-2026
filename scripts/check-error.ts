import mongoose from 'mongoose';

const MONGO_URI = 'mongodb+srv://kriquelme10_db_user:sUBCG6imJ3gcRzCI@cluster0.1grzrfe.mongodb.net/test?appName=Cluster0';

async function main() {
  await mongoose.connect(MONGO_URI);
  
  // Get failed message with all error details
  const msg = await mongoose.connection.collection('whatsappmessages')
    .find({ phone: '5492995095230', status: 'failed' })
    .sort({ createdAt: -1 })
    .limit(1)
    .next();
  
  console.log('Error message:', msg?.errorMessage);
  console.log('Full doc:', JSON.stringify(msg, null, 2));
  
  // Also check logs for this phone number
  console.log('\n=== Checking if webhook notified failure ===');
  // Just show timestamps
  console.log('Message created:', msg?.createdAt);
  console.log('Message failedAt:', msg?.failedAt);
  console.log('Diff (ms):', new Date(msg?.failedAt) - new Date(msg?.createdAt));
  
  await mongoose.disconnect();
}

main().catch(console.error);
