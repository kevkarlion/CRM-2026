import mongoose from 'mongoose';
const MONGO_URI = 'mongodb+srv://kriquelme10_db_user:sUBCG6imJ3gcRzCI@cluster0.1grzrfe.mongodb.net/test?appName=Cluster0';
async function main() {
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;
  // El tlf del audio: 5492984252859
  const rows = await db.collection('whatsappmessages')
    .find({ phone: { $regex: '5492984252859' } })
    .sort({ createdAt: -1 }).limit(8).toArray();
  console.log('Total de mensajes de esa conversación:', rows.length);
  for (const r of rows) {
    console.log('---');
    console.log('_id:', String(r._id));
    console.log('messageId:', r.messageId);
    console.log('type:', r.type, '| direction:', r.direction, '| status:', r.status);
    console.log('mediaId:', r.metadata?.mediaId);
    console.log('cloudinaryUrl:', r.metadata?.cloudinaryUrl || '(sin url)');
    console.log('createdAt:', r.createdAt);
  }
  await mongoose.disconnect();
}
main().catch((e)=>{console.error(e);process.exit(1);});
