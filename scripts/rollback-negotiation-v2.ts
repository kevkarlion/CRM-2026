import { config } from 'dotenv';
config({ path: '.env.local' });

import mongoose from 'mongoose';
const { connectDB } = await import('../src/core/db');

async function rollback() {
  await connectDB();

  const db = mongoose.connection.db!;
  const collection = db.collection('negotiations');

  // 1. Remove commercialEvents and followUp
  await collection.updateMany(
    {},
    { $unset: { commercialEvents: '', followUp: '' } }
  );
  console.log('✓ Removed commercialEvents and followUp');

  // 2. Remove status and respondedAt from counterOffers
  await collection.updateMany(
    {},
    { $unset: { 'counterOffers.$[].status': '', 'counterOffers.$[].respondedAt': '' } }
  );
  console.log('✓ Removed status/respondedAt from counterOffers');

  // 3. Re-add version field
  await collection.updateMany(
    {},
    { $set: { version: 1 } }
  );
  console.log('✓ Restored version field');

  await mongoose.disconnect();
  console.log('\n✅ Rollback complete');
}

rollback().catch(err => { console.error(err); process.exit(1); });
