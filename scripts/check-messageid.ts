import mongoose from 'mongoose';
const MONGO_URI = 'mongodb+srv://kriquelme10_db_user:sUBCG6imJ3gcRzCI@cluster0.1grzrfe.mongodb.net/test?appName=Cluster0';
const MID = 'wamid.HBgNNTQ5Mjk4NDI1Mjg1ORUCABIYFDJBMzQyMEU5RjY5NkJDNDNCOUY3AA==';
async function main() {
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;
  const r = await db.collection('whatsappmessages').findOne({ messageId: MID });
  if (!r) { console.log('NO encontrado'); await mongoose.disconnect(); return; }
  console.log('_id:', String(r._id));
  console.log('type:', r.type, '| direction:', r.direction);
  console.log('mediaId:', r.metadata?.mediaId);
  console.log('cloudinaryUrl:', r.metadata?.cloudinaryUrl || '(sin url)');
  console.log('mimeType:', r.metadata?.mimeType);
  console.log('createdAt:', r.createdAt);
  await mongoose.disconnect();
}
main().catch((e)=>{console.error(e);process.exit(1);});
