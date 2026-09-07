import { config } from 'dotenv'; config({ path: '.env.local' });
import mongoose from 'mongoose';

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);
  const db = mongoose.connection.db!;
  const LEAD = '6a959e0039ecbcfc119e9c9e';

  const lead = await db.collection('leads').findOne({ _id: new mongoose.Types.ObjectId(LEAD) });
  console.log('LEAD:', lead?.name, '| status:', lead?.status, '| created:', lead?.createdAt?.toISOString?.());
  if (!lead) process.exit(0);

  // Conversaciones vinculadas al lead
  const convs = await db.collection('conversations').find({ leadId: lead._id }).toArray();
  console.log('\nCONVERSACIONES vinculadas al lead:', convs.length);
  for (const c of convs) {
    console.log('  conv:', String(c._id), '| type:', c.conversationType, '| lifecycle:', c.lifecycleState, '| channel:', c.channel || c.platform || '—');
    console.log('    isBotActive:', c.isBotActive, '| handoffPending:', c.isHandoffPending, '| botExitedAt:', c.botExitedAt?.toISOString?.() || '—');
    console.log('    lastInbound:', c.lastInboundAt?.toISOString?.() || '—', '| lastOutbound:', c.lastOutboundAt?.toISOString?.() || '—');
    console.log('    lastReadAt:', c.lastReadAt?.toISOString?.() || '—', '| assignedTo:', c.assignedTo ? String(c.assignedTo) : '—');
    console.log('    summary:', c.summary ? String(c.summary).slice(0,200) : '—');
  }

  // Mensajes de la conversación
  const convIds = convs.map(c => c._id);
  if (convIds.length) {
    const msgs = await db.collection('whatsappmessages').find({ conversationId: { $in: convIds } }).sort({ createdAt: 1 }).toArray();
    console.log('\nMENSAJES:', msgs.length);
    for (const m of msgs) {
      console.log(`  [${m.createdAt?.toISOString?.()}] dir=${m.direction || '—'} role=${m.role || '—'} from=${m.from || '—'} via=${m.viaBot ? 'BOT' : (m.senderType || '—')}`);
      console.log(`     ${String(m.body || m.content || m.text || '—').slice(0, 200)}`);
    }
  }

  await mongoose.disconnect();
}
main().catch(e=>{console.error(e);process.exit(1);});
