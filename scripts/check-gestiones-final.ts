import mongoose from 'mongoose';

const MONGO_URI = 'mongodb+srv://kriquelme10_db_user:sUBCG6imJ3gcRzCI@cluster0.1grzrfe.mongodb.net/crm2026?appName=Cluster0';

async function main() {
  await mongoose.connect(MONGO_URI);
  
  const db = mongoose.connection.db;
  console.log('Database name:', db.databaseName);
  
  const count = await db.collection('gestiones').countDocuments();
  console.log('Total gestiones:', count);
  
  // Check by phone
  const gestions = await db.collection('gestiones').find({ phone: '5492995095230' }).toArray();
  console.log('Gestiones by phone:', gestions.length);
  if (gestions.length > 0) {
    console.log(JSON.stringify(gestions, null, 2));
  }
  
  await mongoose.disconnect();
}

main().catch(console.error);
