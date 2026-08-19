/**
 * Debug: Check pipeline stages
 */

import 'dotenv/config';
import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://kriquelme10_db_user:sUBCG6imJ3gcRzCI@cluster0.1grzrfe.mongodb.net/test?appName=Cluster0';

async function debug() {
  const conn = await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB');

  const db = mongoose.connection.db;
  const pipelines = await db.collection('pipelines').find({}).limit(5).toArray();
  
  console.log('\n📊 Pipelines:', JSON.stringify(pipelines, null, 2));

  await mongoose.disconnect();
}

debug().catch(console.error);