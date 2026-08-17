/**
 * Cleanup script - Delete all data related to phone 5492984252859
 * Usage: npx tsx scripts/db-cleanup.ts 5492984252859
 */

import 'dotenv/config';
import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://kriquelme10_db_user:sUBCG6imJ3gcRzCI@cluster0.1grzrfe.mongodb.net/test?appName=Cluster0';

const PHONE = process.argv[2] || '5492984252859';
const NORMALIZED = PHONE.replace(/\D/g, '');

async function cleanup() {
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB\n');
  console.log(`📱 Phone: ${PHONE}\n`);

  const db = mongoose.connection.db;
  let total = 0;

  // 1. Delete Leads
  const leadsResult = await db.collection('leads').deleteMany({
    $or: [
      { phone: PHONE },
      { phone: NORMALIZED },
      { phone: { $regex: NORMALIZED.slice(-9) } }
    ]
  });
  console.log(`🗑️  Deleted ${leadsResult.deletedCount} leads`);
  total += leadsResult.deletedCount;

  // 2. Delete Clients
  const clientsResult = await db.collection('clients').deleteMany({
    $or: [
      { phone: PHONE },
      { phone: NORMALIZED },
      { phone: { $regex: NORMALIZED.slice(-9) } }
    ]
  });
  console.log(`🗑️  Deleted ${clientsResult.deletedCount} clients`);
  total += clientsResult.deletedCount;

  // 3. Delete Gestiones
  const gestionsResult = await db.collection('gestions').deleteMany({
    $or: [
      { phone: PHONE },
      { phone: NORMALIZED },
      { phone: { $regex: NORMALIZED.slice(-9) } }
    ]
  });
  console.log(`🗑️  Deleted ${gestionsResult.deletedCount} gestions`);
  total += gestionsResult.deletedCount;

  // 4. Delete Conversations
  const conversationsResult = await db.collection('conversations').deleteMany({
    $or: [
      { phoneNumber: PHONE },
      { phoneNumber: NORMALIZED },
      { phoneNumber: { $regex: NORMALIZED.slice(-9) } }
    ]
  });
  console.log(`🗑️  Deleted ${conversationsResult.deletedCount} conversations`);
  total += conversationsResult.deletedCount;

  // 5. Delete Messages
  const messagesResult = await db.collection('whatsapp_messages').deleteMany({
    $or: [
      { from: PHONE },
      { from: NORMALIZED },
      { from: { $regex: NORMALIZED.slice(-9) } },
      { to: PHONE },
      { to: NORMALIZED },
      { to: { $regex: NORMALIZED.slice(-9) } }
    ]
  });
  console.log(`🗑️  Deleted ${messagesResult.deletedCount} messages`);
  total += messagesResult.deletedCount;

  // 6. Delete Work Orders (by client phone in snapshot)
  const workOrdersResult = await db.collection('workorders').deleteMany({
    $or: [
      { 'clientSnapshot.phone': PHONE },
      { 'clientSnapshot.phone': NORMALIZED },
      { 'clientSnapshot.phone': { $regex: NORMALIZED.slice(-9) } }
    ]
  });
  console.log(`🗑️  Deleted ${workOrdersResult.deletedCount} work orders`);
  total += workOrdersResult.deletedCount;

  // 7. Delete Quotes
  const quotesResult = await db.collection('quotes').deleteMany({
    $or: [
      { phone: PHONE },
      { phone: NORMALIZED }
    ]
  });
  console.log(`🗑️  Deleted ${quotesResult.deletedCount} quotes`);
  total += quotesResult.deletedCount;

  console.log(`\n📊 Total: ${total} documentos borrados`);

  await mongoose.disconnect();
  console.log('✅ Cleanup complete!');
  process.exit(0);
}

cleanup().catch(console.error);