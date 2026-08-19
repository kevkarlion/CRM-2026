/**
 * Complete cleanup for phone 5492984252859
 * Deletes: messages, conversations, leads, clients, gestions
 */

import 'dotenv/config';
import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://kriquelme10_db_user:sUBCG6imJ3gcRzCI@cluster0.1grzrfe.mongodb.net/test?appName=Cluster0';

async function cleanup() {
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB\n');

  const phone = '5492984252859';
  const normalized = phone.replace(/[\s\-\(\)\+]/g, '');
  const last9 = normalized.slice(-9);

  const db = mongoose.connection.db;

  // Delete WhatsApp messages
  const msgResult = await db.collection('whatsappmessages').deleteMany({
    phoneNumber: { $in: [phone, normalized, last9] }
  });
  console.log(`🗑️  whatsappmessages: ${msgResult.deletedCount} documentos borrados`);

  // Delete conversations
  const convResult = await db.collection('conversations').deleteMany({
    phoneNumber: { $in: [phone, normalized, last9] }
  });
  console.log(`🗑️  conversations: ${convResult.deletedCount} documentos borrados`);

  // Delete leads
  const leadResult = await db.collection('leads').deleteMany({
    $or: [
      { phone: phone },
      { phone: normalized },
      { phone: last9 }
    ]
  });
  console.log(`🗑️  leads: ${leadResult.deletedCount} documentos borrados`);

  // Delete clients
  const clientResult = await db.collection('clients').deleteMany({
    $or: [
      { phone: phone },
      { phone: normalized },
      { phone: last9 }
    ]
  });
  console.log(`🗑️  clients: ${clientResult.deletedCount} documentos borrados`);

  // Delete gestions
  const gestionResult = await db.collection('gestiones').deleteMany({
    $or: [
      { phone: phone },
      { phone: normalized },
      { phone: last9 }
    ]
  });
  console.log(`🗑️  gestions: ${gestionResult.deletedCount} documentos borrados`);

  console.log('\n✅ Limpieza completa');

  await mongoose.disconnect();
}

cleanup().catch(console.error);