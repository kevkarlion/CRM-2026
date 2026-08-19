/**
 * Complete Cleanup script - Delete ALL data related to a phone
 * Usage: npx tsx scripts/db-cleanup.ts 5492984252859
 * 
 * Cleans: leads, clients, gestions, conversations, messages, 
 * work orders, quotes, negotiations, technical visits, contracts,
 * service histories, and more
 */

import 'dotenv/config';
import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://kriquelme10_db_user:sUBCG6imJ3gcRzCI@cluster0.1grzrfe.mongodb.net/test?appName=Cluster0';

const PHONE = process.argv[2] || '5492984252859';
const NORMALIZED = PHONE.replace(/\D/g, '');
const LAST_9 = NORMALIZED.slice(-9);

async function cleanup() {
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB\n');
  console.log(`📱 Phone: ${PHONE} (normalized: ${NORMALIZED})\n`);

  const db = mongoose.connection.db;
  let total = 0;

  // Helper para buscar por teléfono
  const phoneQuery = {
    $or: [
      { phone: PHONE },
      { phone: NORMALIZED },
      { phone: { $regex: new RegExp(NORMALIZED) } },
      { phone: { $regex: new RegExp(LAST_9) } },
      { phoneNumber: PHONE },
      { phoneNumber: NORMALIZED },
      { phoneNumber: { $regex: new RegExp(NORMALIZED) } },
      { phoneNumber: { $regex: new RegExp(LAST_9) } },
    ]
  };

  // 1. Find client IDs first (for cascade delete)
  const clients = await db.collection('clients').find(phoneQuery).toArray();
  const clientIds = clients.map(c => c._id);
  const leadIds = (await db.collection('leads').find(phoneQuery).toArray()).map(l => l._id);

  console.log(`📋 Found ${clients.length} clients, ${leadIds.length} leads\n`);

  // 2. Delete Conversations FIRST (before clients/leads)
  const conversationsResult = await db.collection('conversations').deleteMany(phoneQuery);
  console.log(`🗑️  Deleted ${conversationsResult.deletedCount} conversations`);
  total += conversationsResult.deletedCount;

  // 3. Delete Clients
  const clientsResult = await db.collection('clients').deleteMany(phoneQuery);
  console.log(`🗑️  Deleted ${clientsResult.deletedCount} clients`);
  total += clientsResult.deletedCount;

  // 4. Delete Leads
  const leadsResult = await db.collection('leads').deleteMany(phoneQuery);
  console.log(`🗑️  Deleted ${leadsResult.deletedCount} leads`);
  total += leadsResult.deletedCount;

  // 5. Delete Gestions (by phone or clientId)
  const gestionsQuery = clientIds.length > 0 
    ? { $or: [phoneQuery, { clientId: { $in: clientIds } }] }
    : phoneQuery;
  const gestionsResult = await db.collection('gestions').deleteMany(gestionsQuery);
  console.log(`🗑️  Deleted ${gestionsResult.deletedCount} gestions`);
  total += gestionsResult.deletedCount;

  // 6. Delete WhatsApp Messages (both from and to) - check both collection names
  const messagesQuery = {
    $or: [
      { from: PHONE },
      { from: NORMALIZED },
      { from: { $regex: new RegExp(LAST_9) } },
      { to: PHONE },
      { to: NORMALIZED },
      { to: { $regex: new RegExp(LAST_9) } },
      { phoneNumber: PHONE },
      { phoneNumber: NORMALIZED },
      { phoneNumber: { $regex: new RegExp(LAST_9) } },
      { phone: PHONE },
      { phone: NORMALIZED },
      { phone: { $regex: new RegExp(LAST_9) } },
    ]
  };
  
  // whatsappmessages (singular, sin guión)
  const messagesResult1 = await db.collection('whatsappmessages').deleteMany(messagesQuery);
  console.log(`🗑️  Deleted ${messagesResult1.deletedCount} whatsappmessages`);
  total += messagesResult1.deletedCount;
  
  // whatsapp_messages (plural, con guión bajo)
  const messagesResult2 = await db.collection('whatsapp_messages').deleteMany(messagesQuery);
  console.log(`🗑️  Deleted ${messagesResult2.deletedCount} whatsapp_messages`);
  total += messagesResult2.deletedCount;

  // 7. Delete Work Orders (by client phone or clientId)
  const woQuery = clientIds.length > 0
    ? { $or: [phoneQuery, { clientId: { $in: clientIds } }] }
    : phoneQuery;
  const workOrdersResult = await db.collection('workorders').deleteMany(woQuery);
  console.log(`🗑️  Deleted ${workOrdersResult.deletedCount} workorders`);
  total += workOrdersResult.deletedCount;

  // 8. Delete Quotes (by leadId or phone)
  const quotesQuery = leadIds.length > 0 || clientIds.length > 0
    ? { $or: [phoneQuery, { leadId: { $in: leadIds } }, { clientId: { $in: clientIds } }] }
    : phoneQuery;
  const quotesResult = await db.collection('quotes').deleteMany(quotesQuery);
  console.log(`🗑️  Deleted ${quotesResult.deletedCount} quotes`);
  total += quotesResult.deletedCount;

  // 9. Delete Negotiations
  const negotiationsQuery = leadIds.length > 0 || clientIds.length > 0
    ? { $or: [phoneQuery, { leadId: { $in: leadIds } }, { clientId: { $in: clientIds } }] }
    : phoneQuery;
  const negotiationsResult = await db.collection('negotiations').deleteMany(negotiationsQuery);
  console.log(`🗑️  Deleted ${negotiationsResult.deletedCount} negotiations`);
  total += negotiationsResult.deletedCount;

  // 10. Delete Technical Visits
  const visitsQuery = leadIds.length > 0 || clientIds.length > 0
    ? { $or: [phoneQuery, { leadId: { $in: leadIds } }, { clientId: { $in: clientIds } }] }
    : phoneQuery;
  const visitsResult = await db.collection('technicalvisits').deleteMany(visitsQuery);
  console.log(`🗑️  Deleted ${visitsResult.deletedCount} technicalvisits`);
  total += visitsResult.deletedCount;

  // 11. Delete Contracts
  const contractsQuery = clientIds.length > 0
    ? { $or: [phoneQuery, { clientId: { $in: clientIds } }] }
    : phoneQuery;
  const contractsResult = await db.collection('contracts').deleteMany(contractsQuery);
  console.log(`🗑️  Deleted ${contractsResult.deletedCount} contracts`);
  total += contractsResult.deletedCount;

  // 12. Delete Service Histories
  const serviceHistoriesQuery = clientIds.length > 0
    ? { $or: [phoneQuery, { clientId: { $in: clientIds } }] }
    : phoneQuery;
  const serviceHistoriesResult = await db.collection('clientservicehistories').deleteMany(serviceHistoriesQuery);
  console.log(`🗑️  Deleted ${serviceHistoriesResult.deletedCount} clientservicehistories`);
  total += serviceHistoriesResult.deletedCount;

  // 13. Delete Client Activities / Timeline
  const activitiesQuery = clientIds.length > 0
    ? { $or: [phoneQuery, { clientId: { $in: clientIds } }] }
    : phoneQuery;
  const activitiesResult = await db.collection('clientactivities').deleteMany(activitiesQuery);
  console.log(`🗑️  Deleted ${activitiesResult.deletedCount} clientactivities`);
  total += activitiesResult.deletedCount;

  // 14. Delete Audit Logs
  const auditQuery = {
    $or: [
      phoneQuery,
      ...(clientIds.length > 0 ? [{ entityId: { $in: clientIds } }] : []),
      ...(leadIds.length > 0 ? [{ entityId: { $in: leadIds } }] : []),
    ]
  };
  const auditResult = await db.collection('auditlogs').deleteMany(auditQuery);
  console.log(`🗑️  Deleted ${auditResult.deletedCount} auditlogs`);
  total += auditResult.deletedCount;

  console.log(`\n📊 Total: ${total} documentos borrados`);

  await mongoose.disconnect();
  console.log('✅ Cleanup complete!');
  process.exit(0);
}

cleanup().catch(console.error);