import { config } from 'dotenv'; config({ path: '.env.local' });
import mongoose from 'mongoose';

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);
  const db = mongoose.connection.db!;
  const TENANT = new mongoose.Types.ObjectId('6a45a83e202f4857cebf0e72');
  const LEAD_ID = new mongoose.Types.ObjectId('6a9ed30b5578a8f46f817214');
  const CLIENT_ID = new mongoose.Types.ObjectId('6a9ed934a68c3f3b79af5e36');
  const PHONE = '5492984252859';

  // 1. Lead completo
  const lead = await db.collection('leads').findOne({ _id: LEAD_ID });
  console.log('=== LEAD (todos los campos) ===');
  console.log(JSON.stringify(lead, null, 2).replace(/\"_id\"/g, '"id"'));

  // 2. Cliente completo
  const client = await db.collection('clients').findOne({ _id: CLIENT_ID });
  console.log('\n=== CLIENT (todos los campos) ===');
  console.log(JSON.stringify(client, null, 2).replace(/\"_id\"/g, '"id"'));

  // 3. Conversación
  const conv = await db.collection('conversations').findOne({ tenantId: TENANT, phoneNumber: PHONE });
  console.log('\n=== CONVERSATION ===');
  console.log(JSON.stringify({ id: conv?._id, type: conv?.conversationType, lifecycle: conv?.lifecycleState, owner: conv?.owner, state: conv?.state, context: conv?.context, step: conv?.step, engineData: conv?.engineData }, null, 2));

  // 4. Mensajes del flujo (los primeros y últimos)
  const msgs = await db.collection('whatsappmessages').find({ tenantId: TENANT, phone: PHONE })
    .sort({ createdAt: 1 }).toArray();
  console.log(`\n=== MENSAJES (${msgs.length}) ===`);
  for (const m of msgs) {
    const extra = m.type === 'image' ? ` [mediaId=${m.mediaId || m.mediaUrl || ''}]` : '';
    console.log(`${new Date(m.createdAt).toISOString().slice(11,19)} [${m.direction}] (${m.type}) ${String(m.content || '').slice(0,120)}${extra}`);
  }

  await mongoose.disconnect();
}
main().catch(e=>{console.error(e);process.exit(1);});
