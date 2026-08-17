/**
 * Debug: List all clients
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import ClientModel from '../../crm/models/client';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://kriquelme10_db_user:sUBCG6imJ3gcRzCI@cluster0.1grzrfe.mongodb.net/test?appName=Cluster0';

async function debug() {
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB\n');

  const clients = await ClientModel.find().limit(10).lean();
  console.log('📊 Total clients in DB:', await ClientModel.countDocuments());
  
  console.log('\n📱 Sample clients:');
  for (const c of clients) {
    console.log(`   ${c.name} - ${c.phone}`);
  }

  await mongoose.disconnect();
}

debug().catch(console.error);