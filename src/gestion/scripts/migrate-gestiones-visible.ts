/**
 * Migration script: Add isVisible=true to existing non-terminal Gestiones
 * 
 * This migration ensures all existing Gestiones are visible in the pipeline
 * after the new isVisible field is added to the schema.
 * 
 * Usage:
 *   npx tsx src/gestion/scripts/migrate-gestiones-visible.ts
 * 
 * Or run directly with Node (if compiled):
 *   node dist/gestion/scripts/migrate-gestiones-visible.js
 */

import mongoose from 'mongoose';
import { connectDB } from '@/core/db';

async function migrate() {
  console.log('🔄 Starting migration: Add isVisible=true to existing Gestiones\n');
  
  await connectDB();
  
  const db = mongoose.connection.db;
  const gestionCollection = db.collection('gestions');
  
  // Count total Gestiones
  const totalCount = await gestionCollection.countDocuments({});
  console.log(`Total Gestiones in database: ${totalCount}`);
  
  // Find non-terminal Gestiones (not won, lost, or closed)
  const nonTerminalQuery = {
    status: { $nin: ['won', 'lost', 'closed'] },
    $or: [
      { isVisible: { $exists: false } },
      { isVisible: null },
      { isVisible: { $exists: true, $ne: true } }, // not true
    ],
  };
  
  const nonTerminalCount = await gestionCollection.countDocuments(nonTerminalQuery);
  console.log(`Non-terminal Gestiones needing isVisible=true: ${nonTerminalCount}`);
  
  if (nonTerminalCount === 0) {
    console.log('✅ No Gestiones need migration. Exiting.');
    await mongoose.disconnect();
    return;
  }
  
  // Perform the update
  const result = await gestionCollection.updateMany(
    nonTerminalQuery,
    {
      $set: { isVisible: true },
    }
  );
  
  console.log(`✅ Migration complete: ${result.modifiedCount} Gestiones updated`);
  
  // Verify the migration
  const remainingQuery = {
    status: { $nin: ['won', 'lost', 'closed'] },
    $or: [
      { isVisible: { $exists: false } },
      { isVisible: null },
      { isVisible: { $ne: true } },
    ],
  };
  
  const remainingCount = await gestionCollection.countDocuments(remainingQuery);
  console.log(`Remaining non-terminal Gestiones without isVisible: ${remainingCount}`);
  
  if (remainingCount > 0) {
    console.warn('⚠️ Warning: Some Gestiones were not migrated');
  } else {
    console.log('✅ All non-terminal Gestiones now have isVisible=true');
  }
  
  await mongoose.disconnect();
  console.log('\n👋 Migration finished.');
}

migrate().catch((error) => {
  console.error('❌ Migration failed:', error);
  process.exit(1);
});