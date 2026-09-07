import { config } from 'dotenv'; config({ path: '.env.local' });
import mongoose from 'mongoose';

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);
  const db = mongoose.connection.db!;
  const PHONE = '5492995470523';

  // 1. Un mensaje crudo: ver TODAS sus keys (para saber qué los vincula)
  const sample = await db.collection('whatsappmessages').findOne({ $or: [{ from: PHONE }, { to: PHONE }, { phone: PHONE }] });
  console.log('KEYS de un mensaje:', Object.keys(sample || {}).join(', '));
  console.log('FULL sample:', JSON.stringify(sample, (k,v) => v instanceof mongoose.Types.ObjectId ? String(v) : v instanceof Date ? v.toISOString() : v, 2).slice(0, 1200));

  // 2. Últimos mensajes con todos sus flags
  const last = await db.collection('whatsappmessages').find({
    $or: [{ from: PHONE }, { to: PHONE }, { phone: PHONE }]
  }).sort({ createdAt: -1 }).limit(6).toArray();
  console.log('\nÚLTIMOS MENSAJES completos:');
  for (const m of last.reverse()) {
    const o: any = {};
    for (const k of ['createdAt','direction','from','to','conversationId','leadId','clientId','body','viaBot','senderType','botHandled','status','type','messageType','processed','ack','metadata']) {
      if (m[k] !== undefined) {
        o[k] = m[k] instanceof mongoose.Types.ObjectId ? String(m[k]) : m[k] instanceof Date ? m[k].toISOString() : m[k];
      }
    }
    console.log(' ', JSON.stringify(o));
  }

  // 3. Estado completo de la conversación
  const c = await db.collection('conversations').findOne({ _id: new mongoose.Types.ObjectId('6a959e0139ecbcfc119e9ca7') });
  console.log('\nCONVERSACIÓN completa:');
  const clean: any = {};
  for (const k of Object.keys(c || {})) {
    clean[k] = (c as any)[k] instanceof mongoose.Types.ObjectId ? String((c as any)[k]) : (c as any)[k] instanceof Date ? (c as any)[k].toISOString() : (c as any)[k];
  }
  console.log(JSON.stringify(clean, null, 2));

  await mongoose.disconnect();
}
main().catch(e=>{console.error(e);process.exit(1);});
