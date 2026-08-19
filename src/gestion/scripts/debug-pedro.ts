/**
 * Debug: Check conversations and find Pedro Arana
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import ConversationModel from '../../conversation/models/conversation';
import ClientModel from '../../crm/models/client';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://kriquelme10_db_user:sUBCG6imJ3gcRzCI@cluster0.1grzrfe.mongodb.net/test?appName=Cluster0';

async function debug() {
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB\n');

  // Find Pedro Arana's conversation
  const conversations = await ConversationModel.find({
    conversationType: 'customer',
    lifecycleState: { $in: ['ACTIVE_CLIENT', 'WAITING_CLIENT', 'IN_PROGRESS'] },
  }).lean();

  console.log('📱 Customer conversations:');
  for (const conv of conversations) {
    console.log(`\n📱 Conversation: ${conv._id}`);
    console.log(`   Phone: ${conv.phoneNumber}`);
    console.log(`   State: ${conv.lifecycleState}`);
    
    // Find client by phone
    const client = await ClientModel.findOne({ phone: conv.phoneNumber }).lean();
    console.log(`   Client found: ${client?.name || 'NOT FOUND'}`);
    console.log(`   Client phone: ${client?.phone}`);
  }

  await mongoose.disconnect();
}

debug().catch(console.error);