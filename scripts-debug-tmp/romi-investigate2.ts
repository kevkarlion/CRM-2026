import { config } from 'dotenv'; config({ path: '.env.local' });
import mongoose from 'mongoose';

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);
  const db = mongoose.connection.db!;
  const PHONE = '5492995470523';

  // 1. Todos los mensajes de WhatsApp con ese número (cualquier campo)
  const msgs = await db.collection('whatsappmessages').find({
    $or: [{ from: PHONE }, { to: PHONE }, { phone: PHONE }]
  }).sort({ createdAt: 1 }).toArray();
  console.log('MENSAJES whatsapp con el número:', msgs.length);
  for (const m of msgs) {
    console.log(`  [${m.createdAt?.toISOString?.()}] convo=${m.conversationId ? String(m.conversationId) : '—'} dir=${m.direction || '—'} role=${m.role || '—'} via=${m.viaBot ? 'BOT' : (m.senderType || '—')}`);
    console.log(`     "${String(m.body || m.content || m.text || '—').slice(0, 250)}"`);
  }

  // 2. Conversaciones vinculadas por clientId/leadId/phone
  const convs = await db.collection('conversations').find({
    $or: [{ clientId: new mongoose.Types.ObjectId('6a99a9afd05df0f75851b35e') }, { leadId: new mongoose.Types.ObjectId('6a959e0039ecbcfc119e9c9e') }]
  }).toArray();
  console.log('\nCONVERSACIONES por clientId/leadId:', convs.length);
  for (const c of convs) {
    console.log(`  conv ${String(c._id)} | type ${c.conversationType} | lifecycle ${c.lifecycleState} | msgsByConvId: ${await db.collection('whatsappmessages').countDocuments({ conversationId: c._id })}`);
  }
  await mongoose.disconnect();
}
main().catch(e=>{console.error(e);process.exit(1);});
