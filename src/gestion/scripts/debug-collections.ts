/**
 * Debug: List all collections
 */

import 'dotenv/config';
import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://kriquelme10_db_user:sUBCG6imJ3gcRzCI@cluster0.1grzrfe.mongodb.net/crm-2026?appName=Cluster0';

async function debug() {
  const conn = await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB');
  console.log('📊 Database:', conn.connection.name);

  const collections = await mongoose.connection.db.listCollections().toArray();
  console.log('📊 Collections:', collections.map(c => c.name));

  await mongoose.disconnect();
}

debug().catch(console.error);