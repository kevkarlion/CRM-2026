/**
 * Debug: Check conversations collection
 */

import 'dotenv/config';
import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://kriquelme10_db_user:sUBCG6imJ3gcRzCI@cluster0.1grzrfe.mongodb.net/crm-2026?appName=Cluster0';

async function debug() {
  const conn = await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB');

  const ConversationModel = (await import('../../conversation/models/conversation.js')).default;

  // Count total
  const total = await ConversationModel.countDocuments();
  console.log('📊 Total conversations:', total);

  // Sample first 5
  const sample = await ConversationModel.find().limit(5).lean();
  console.log('📊 Sample conversations:', JSON.stringify(sample, null, 2));

  await mongoose.disconnect();
}

debug().catch(console.error);