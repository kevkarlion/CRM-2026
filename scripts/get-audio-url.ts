import mongoose from 'mongoose';
const MONGO_URI = 'mongodb+srv://kriquelme10_db_user:sUBCG6imJ3gcRzCI@cluster0.1grzrfe.mongodb.net/test?appName=Cluster0';
async function main() {
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;
  const rows = await db.collection('whatsappmessages')
    .find({ type: 'audio', 'metadata.cloudinaryUrl': { $exists: true } })
    .sort({ createdAt: -1 }).limit(3).toArray();
  for (const r of rows) {
    console.log(r.createdAt, '|', r.metadata.cloudinaryUrl);
  }
  await mongoose.disconnect();
}
main().catch((e)=>{console.error(e);process.exit(1);});
