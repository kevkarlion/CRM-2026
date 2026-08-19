import mongoose from 'mongoose';

const MONGO_URI = 'mongodb+srv://kriquelme10_db_user:sUBCG6imJ3gcRzCI@cluster0.1grzrfe.mongodb.net/test?appName=Cluster0';

async function main() {
  await mongoose.connect(MONGO_URI);
  
  const db = mongoose.connection.db;
  console.log('Database name:', db.databaseName);
  
  const collections = await db.listCollections().toArray();
  console.log('Count:', collections.length);
  
  await mongoose.disconnect();
}

main().catch(console.error);
