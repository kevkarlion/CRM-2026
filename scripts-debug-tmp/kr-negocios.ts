import { config } from 'dotenv'; config({ path: '.env.local' });
import mongoose from 'mongoose';

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);
  const db = mongoose.connection.db!;
  const TENANT = new mongoose.Types.ObjectId('6a45a83e202f4857cebf0e72');
  const match = { $regex: 'KR|Negocios', $options: 'i' };

  const clients = await db.collection('clients').find({ tenantId: TENANT, $or: [{ fullName: match }, { companyName: match }] }).toArray();
  const leads = await db.collection('leads').find({ tenantId: TENANT, $or: [{ name: match }, { companyName: match }, { email: match }] }).toArray();

  console.log('CLIENTS:', clients.length);
  for (const c of clients) console.log(`  ${String(c._id)} | ${c.fullName} | company=${c.companyName || '-'} | phone=${c.phone || '-'} | email=${c.email || '-'} | status=${c.status}`);
  console.log('LEADS:', leads.length);
  for (const l of leads) console.log(`  ${String(l._id)} | ${l.name} | company=${l.companyName || '-'} | phone=${l.phone || '-'} | email=${l.email || '-'} | status=${l.status}`);
  await mongoose.disconnect();
}
main().catch(e=>{console.error(e);process.exit(1);});
