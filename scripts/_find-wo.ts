import mongoose from 'mongoose';
const MONGO_URI = 'mongodb+srv://kriquelme10_db_user:sUBCG6imJ3gcRzCI@cluster0.1grzrfe.mongodb.net/test?appName=Cluster0';
async function main() {
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;
  const orders = await db.collection('workorders')
    .find({ title: { $regex: /KR Negocios Digitales/i } })
    .project({ workOrderNumber: 1, title: 1, status: 1, workStatus: 1, scheduledStart: 1, scheduledEnd: 1, createdAt: 1 })
    .sort({ createdAt: -1 })
    .toArray();
  console.log('OTs con "KR Negocios Digitales":', orders.length);
  for (const o of orders) {
    console.log('---');
    console.log('num:', o.workOrderNumber, '| _id:', String(o._id));
    console.log('  status:', o.status, '| workStatus:', o.workStatus);
    console.log('  scheduledStart:', o.scheduledStart, '| scheduledEnd:', o.scheduledEnd);
  }
  await mongoose.disconnect();
}
main().catch((e)=>{console.error(e);process.exit(1);});
