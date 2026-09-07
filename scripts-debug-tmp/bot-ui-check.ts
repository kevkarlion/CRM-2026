import { config } from 'dotenv'; config({ path: '.env.local' });
import mongoose from 'mongoose';

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);
  const db = mongoose.connection.db!;
  const TENANT = new mongoose.Types.ObjectId('6a45a83e202f4857cebf0e72');

  // Conversaciones con owner=OPERATOR pero lifecycle != IN_PROGRESS (el bug de UI)
  const buggy = await db.collection('conversations').find({
    tenantId: TENANT,
    owner: 'OPERATOR',
    lifecycleState: { $ne: 'IN_PROGRESS' },
  }).toArray();
  console.log('conversaciones owner=OPERATOR pero lifecycle != IN_PROGRESS:', buggy.length);
  for (const c of buggy) {
    const client = c.clientId ? await db.collection('clients').findOne({ _id: c.clientId }, { projection: { fullName: 1, phone: 1 } }) : null;
    const lead = c.leadId ? await db.collection('leads').findOne({ _id: c.leadId }, { projection: { name: 1, status: 1 } }) : null;
    console.log(`  ${String(c._id)} | type=${c.conversationType} | lifecycle=${c.lifecycleState} | state=${c.state} | owner=${c.owner} | entity=${client ? 'CLIENT ' + client.fullName : (lead ? 'LEAD ' + lead.name + ' (' + lead.status + ')' : '—')}`);
  }

  // Cuántas tienen owner=OPERATOR && IN_PROGRESS (las que la UI muestra bien)
  const ok = await db.collection('conversations').countDocuments({ tenantId: TENANT, owner: 'OPERATOR', lifecycleState: 'IN_PROGRESS' });
  console.log('\nowner=OPERATOR && lifecycle=IN_PROGRESS (UI muestra Operador bien):', ok);

  // Cuántas tienen owner=BOT (el bot realmente activo)
  const bot = await db.collection('conversations').countDocuments({ tenantId: TENANT, owner: 'BOT' });
  console.log('owner=BOT (bot realmente activo):', bot);

  await mongoose.disconnect();
}
main().catch(e=>{console.error(e);process.exit(1);});
