import mongoose from 'mongoose';

const MONGO_URI = 'mongodb+srv://kriquelme10_db_user:sUBCG6imJ3gcRzCI@cluster0.1grzrfe.mongodb.net/test?appName=Cluster0';

async function main() {
  await mongoose.connect(MONGO_URI);
  
  // Check ALL messages for this phone - success and failed
  const all = await mongoose.connection.collection('whatsappmessages')
    .find({ phone: '5492995095230' })
    .sort({ createdAt: -1 })
    .toArray();
  
  console.log('Total messages:', all.length);
  
  // Check status breakdown
  const statuses = all.reduce((acc, m) => {
    acc[m.status] = (acc[m.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  console.log('Status breakdown:', statuses);
  
  // Check if there are any successful outbound messages
  const success = all.filter(m => m.direction === 'outbound' && m.status === 'delivered');
  console.log('Delivered outbound:', success.length);
  
  // Also check for any INBOUND messages
  const inbound = all.filter(m => m.direction === 'inbound');
  console.log('Inbound messages:', inbound.length);
  if (inbound.length > 0) {
    console.log('First inbound:', JSON.stringify(inbound[0], null, 2));
  }
  
  await mongoose.disconnect();
}

main().catch(console.error);
