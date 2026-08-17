/**
 * Debug: Check Gestion for client 6a7f752beb4aa6e8755906ce
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import GestionModel from '../models/gestion';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://kriquelme10_db_user:sUBCG6imJ3gcRzCI@cluster0.1grzrfe.mongodb.net/test?appName=Cluster0';

async function debug() {
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB\n');

  const clientId = new mongoose.Types.ObjectId('6a7f752beb4aa6e8755906ce');
  
  const gestion = await GestionModel.findOne({ clientId }).lean();
  
  console.log('📱 Gestion:', gestion);
  console.log('   Name:', gestion?.name);

  await mongoose.disconnect();
}

debug().catch(console.error);