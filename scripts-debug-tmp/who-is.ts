import { config } from 'dotenv';
config({ path: '.env.local' });
import mongoose from 'mongoose';

const PHONE = '5492996265240';

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);
  const db = mongoose.connection.db!;

  const lead = await db.collection('leads').findOne({ phone: { $regex: '2996265240$' }, deletedAt: null });
  console.log('=== LEAD ===');
  if (lead) {
    console.log({
      _id: lead._id,
      name: lead.name,
      profileName: lead.profileName,
      phone: lead.phone,
      status: lead.status,
      qualificationStatus: lead.qualificationStatus,
      source: lead.source,
      createdAt: lead.createdAt,
      updatedAt: lead.updatedAt,
      convertedToClient: lead.convertedToClient,
      isB2B: lead.isB2B,
      customerType: lead.customerType,
      notes: lead.notes,
    });
  } else {
    console.log('NO LEAD');
  }

  const client = await db.collection('clients').findOne({ phone: { $regex: '2996265240$' }, deletedAt: null });
  console.log('\n=== CLIENT ===');
  if (client) {
    console.log({ _id: client._id, fullName: client.fullName, profileName: client.profileName, phone: client.phone, email: client.email, createdAt: client.createdAt });
  } else {
    console.log('NO CLIENT');
  }

  const convs = await db.collection('conversations').find({ phoneNumber: { $regex: '2996265240$' } }).sort({ lastMessageAt: -1 }).toArray();
  console.log('\n=== CONVERSACIONES ===');
  for (const c of convs) {
    console.log({ _id: c._id, conversationType: c.conversationType, lifecycleState: c.lifecycleState, state: c.state, owner: c.owner, leadId: c.leadId, clientId: c.clientId, closedAt: c.closedAt, lastMessageAt: c.lastMessageAt });
  }

  const msgs = await db.collection('whatsappmessages').find({ phone: { $regex: '2996265240$' } }).sort({ createdAt: -1 }).limit(5).toArray();
  console.log('\n=== ULTIMOS MENSAJES ===');
  for (const m of msgs) {
    console.log(`${m.createdAt?.toISOString?.() ?? m.createdAt} | dir=${m.direction ?? m.role ?? '?'} | ${(m.content ?? '').slice(0, 80)}`);
  }

  await mongoose.disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });