/**
 * Debug: Check conversation data
 */

import 'dotenv/config';
import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://kriquelme10_db_user:sUBCG6imJ3gcRzCI@cluster0.1grzrfe.mongodb.net/crm-2026?appName=Cluster0';

async function debug() {
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB\n');

  const ConversationModel = (await import('../../conversation/models/conversation.js')).default;

  // Get all lifecycleState values
  const lifecycleStates = await ConversationModel.distinct('lifecycleState');
  console.log('📊 lifecycleState values:', lifecycleStates);

  // Get all conversationType values
  const conversationTypes = await ConversationModel.distinct('conversationType');
  console.log('📊 conversationType values:', conversationTypes);

  // Count by lifecycleState
  const counts = await ConversationModel.aggregate([
    { $group: { _id: '$lifecycleState', count: { $sum: 1 } } }
  ]);
  console.log('📊 Counts by lifecycleState:', counts);

  // Count by conversationType
  const typeCounts = await ConversationModel.aggregate([
    { $group: { _id: '$conversationType', count: { $sum: 1 } } }
  ]);
  console.log('📊 Counts by conversationType:', typeCounts);

  await mongoose.disconnect();
}

debug().catch(console.error);