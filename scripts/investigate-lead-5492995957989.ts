import mongoose from 'mongoose';

const MONGO_URI = 'mongodb+srv://kriquelme10_db_user:sUBCG6imJ3gcRzCI@cluster0.1grzrfe.mongodb.net/test?appName=Cluster0';

const PHONE = '5492995957989';

async function main() {
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;

  const collections = await db.listCollections().toArray();
  console.log('=== Colecciones disponibles ===');
  collections.forEach((c) => console.log('  -', c.name));
  console.log();

  // Normalizar variantes del teléfono (con/sin 549, con/sin 9, etc.)
  const variants = [PHONE, PHONE.slice(3), PHONE.slice(4)];
  console.log('=== Buscando teléfono', PHONE, '===\n');

  const search = (col: string, query: any, label?: string) =>
    db.collection(col).find(query).toArray();

  // 1. LEADS
  const leads = await search('leads', { deletedAt: null, $or: [
    { phone: { $in: variants } },
    { phone: { $regex: new RegExp(PHONE.slice(3) + '$') } },
  ]});
  console.log(`\n### LEADS (${leads.length})`);
  for (const l of leads) {
    console.log(`  ${l.name} | _id: ${l._id} | status: ${l.status} | phone: ${l.phone}`);
    console.log(`    createdAt: ${l.createdAt} | source: ${l.source ?? '-'} | email: ${l.email ?? '-'}`);
    console.log(`    adminNotes: ${(l.adminNotes ?? '-').substring(0, 80)}`);
    console.log(`    notes: ${(l.notes ?? '-').substring(0, 80)}`);
  }

  const leadIds = leads.map((l) => l._id);

  // 2. CONVERSATIONS (por leadId o phoneNumber)
  const convs = await search('conversations', { $or: [
    { leadId: { $in: leadIds } },
    { phoneNumber: { $in: variants } },
  ]});
  console.log(`\n### CONVERSATIONS (${convs.length})`);
  const convIds = convs.map((c) => c._id);
  for (const c of convs) {
    console.log(`  _id: ${c._id} | leadId: ${c.leadId} | state: ${c.lifecycleState} | type: ${c.conversationType}`);
    console.log(`    phone: ${c.phoneNumber} | owner: ${c.owner} | createdAt: ${c.createdAt}`);
    console.log(`    intent: ${c.intent ?? '-'} | urgency: ${c.urgency ?? '-'}`);
  }

  // 3. WHATSAPP-MESSAGES
  const msgs = await search('whatsapp-messages', {
    $or: [{ leadId: { $in: leadIds } }, { conversationId: { $in: convIds } }, { phone: { $in: variants } }],
  }).then((r) => r.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
  console.log(`\n### WHATSAPP-MESSAGES (${msgs.length})`);
  msgs.forEach((m) => {
    console.log(`  [${new Date(m.createdAt).toISOString()}] dir=${m.direction} | ${(m.content ?? '').substring(0, 90)}`);
  });

  // 4. CLIENTS (por teléfono o originLeadId)
  const clients = await search('clients', { deletedAt: null, $or: [
    { phone: { $in: variants } },
    { originLeadId: { $in: leadIds } },
    { 'contact.phone': { $in: variants } },
  ]});
  console.log(`\n### CLIENTS (${clients.length})`);
  for (const c of clients) {
    console.log(`  ${c.fullName ?? c.name} | _id: ${c._id} | phone: ${c.phone}`);
    console.log(`    status: ${c.status} | operationStatus: ${c.operationStatus ?? '-'}`);
    console.log(`    originLeadId: ${c.originLeadId ?? '-'} | inheritNotes: ${(c.inheritNotes ?? '-').substring(0, 80)}`);
    console.log(`    notes: ${(c.notes ?? '-').substring(0, 80)}`);
  }
  const clientIds = clients.map((c) => c._id);

  // 5. WORKORDERS (órdenes de trabajo)
  const workorders = await search('workorders', { deletedAt: null, $or: [
    { clientId: { $in: clientIds } },
    { leadId: { $in: leadIds } },
    { 'clientSnapshot.phone': { $in: variants } },
  ]});
  console.log(`\n### WORKORDERS (${workorders.length})`);
  workorders.forEach((w) => {
    console.log(`  ${w.workOrderNumber ?? '-'} | ${w.title ?? '-'} | status: ${w.status} | clientId: ${w.clientId ?? '-'}`);
    console.log(`    scheduled: ${w.scheduledDate ?? '-'} | createdAt: ${w.createdAt ?? '-'}`);
  });

  // 6. ACTIVITY LOGS / NOTAS
  const activities = await search('activitylogs', { $or: [
    { leadId: { $in: leadIds } },
    { clientId: { $in: clientIds } },
    { entityId: { $in: [...leadIds, ...clientIds] } },
  ]});
  console.log(`\n### ACTIVITYLOGS (${activities.length})`);
  activities.slice(0, 20).forEach((a) => {
    console.log(`  [${new Date(a.createdAt).toISOString()}] type=${a.type ?? '-'} | ${(a.description ?? a.message ?? a.details ?? '').substring(0, 90)}`);
  });

  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });