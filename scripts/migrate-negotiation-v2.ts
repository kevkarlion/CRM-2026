import { config } from 'dotenv';
config({ path: '.env.local' });

import mongoose from 'mongoose';
const { connectDB } = await import('../src/core/db');

async function migrate() {
  await connectDB();

  const db = mongoose.connection.db!;
  const collection = db.collection('negotiations');

  // 1. Remove version field
  await collection.updateMany(
    {},
    { $unset: { version: '' } }
  );
  console.log('✓ Removed version field');

  // 2. Add status and respondedAt to existing counterOffers
  await collection.updateMany(
    {},
    {
      $set: {
        'counterOffers.$[].status': 'pending',
        'counterOffers.$[].respondedAt': null,
      },
    }
  );
  console.log('✓ Set default status/respondedAt on counterOffers');

  // 3. Add commercialEvents and followUp defaults
  await collection.updateMany(
    {},
    {
      $set: {
        commercialEvents: [],
        followUp: null,
      },
    }
  );
  console.log('✓ Added commercialEvents and followUp defaults');

  await mongoose.disconnect();
  console.log('\n✅ Migration complete');
}

migrate().catch(err => { console.error(err); process.exit(1); });
