import { config } from 'dotenv';
config({ path: '.env.local' });

import mongoose from 'mongoose';
const { connectDB } = await import('../src/core/db');

async function migrate() {
  await connectDB();

  const db = mongoose.connection.db!;
  const collection = db.collection('whatsappmessages');

  const total = await collection.countDocuments({});
  console.log(`Found ${total} WhatsApp messages`);

  // Set status on existing outbound messages: 'sent' (they were already sent)
  const outboundResult = await collection.updateMany(
    { direction: 'outbound', status: { $exists: false } },
    { $set: { status: 'sent' } }
  );
  console.log(`✓ Outbound messages → sent (${outboundResult.modifiedCount})`);

  // Set status on existing inbound messages: 'delivered' (they were received)
  const inboundResult = await collection.updateMany(
    { direction: 'inbound', status: { $exists: false } },
    { $set: { status: 'delivered' } }
  );
  console.log(`✓ Inbound messages → delivered (${inboundResult.modifiedCount})`);

  // Catch any remaining messages without status
  const fallbackResult = await collection.updateMany(
    { status: { $exists: false } },
    { $set: { status: 'pending' } }
  );
  console.log(`✓ Remaining messages → pending (${fallbackResult.modifiedCount})`);

  console.log('Migration complete');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
