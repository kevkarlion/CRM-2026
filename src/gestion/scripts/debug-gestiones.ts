/**
 * Debug: Check Gestion data
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import GestionModel from '../models/gestion';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://kriquelme10_db_user:sUBCG6imJ3gcRzCI@cluster0.1grzrfe.mongodb.net/test?appName=Cluster0';

async function debug() {
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB\n');

  const gestions = await GestionModel.find().lean();
  console.log('📊 Total Gestiones:', gestions.length);
  
  for (const g of gestions) {
    console.log(`\n📱 Gestion: ${g.name}`);
    console.log(`   Status: ${g.status}`);
    console.log(`   Phone: ${g.phone}`);
    console.log(`   ClientId: ${g.clientId}`);
    console.log(`   Priority: ${g.priority}`);
  }

  await mongoose.disconnect();
}

debug().catch(console.error);