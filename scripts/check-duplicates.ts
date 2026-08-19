import mongoose from 'mongoose';

const MONGO_URI = 'mongodb+srv://kriquelme10_db_user:sUBCG6imJ3gcRzCI@cluster0.1grzrfe.mongodb.net/test?appName=Cluster0';

async function main() {
  await mongoose.connect(MONGO_URI);
  
  // Check if there are other leads/clients with this phone
  const leads = await mongoose.connection.collection('leads')
    .find({ phone: '5492995095230' })
    .toArray();
  
  console.log('Leads with this phone:', leads.length);
  leads.forEach(l => {
    console.log(`- ${l._id}: ${l.name} | status: ${l.status}`);
  });
  
  const clients = await mongoose.connection.collection('clients')
    .find({ phone: '5492995095230' })
    .toArray();
  
  console.log('\nClients with this phone:', clients.length);
  clients.forEach(c => {
    console.log(`- ${c._id}: ${c.fullName} | status: ${c.status}`);
  });
  
  await mongoose.disconnect();
}

main().catch(console.error);
