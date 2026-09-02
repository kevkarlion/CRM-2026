import mongoose from 'mongoose';
const MONGO_URI = 'mongodb+srv://kriquelme10_db_user:sUBCG6imJ3gcRzCI@cluster0.1grzrfe.mongodb.net/test?appName=Cluster0';
const MID = 'wamid.HBgNNTQ5Mjk4NDI1Mjg1ORUCABIYFDJBNkY0REI2RjBDNkZFMDY3MEJGAA==';
async function main() {
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;
  const rows = await db.collection('whatsappmessages').find({ messageId: MID }).toArray();
  console.log('Total con ese messageId:', rows.length);
  for (const r of rows) {
    console.log('_id:', String(r._id), '| url:', r.metadata?.cloudinaryUrl || '(sin url)', '| mediaId:', r.metadata?.mediaId);
  }
  await mongoose.disconnect();
}
main().catch((e)=>{console.error(e);process.exit(1);});
