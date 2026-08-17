/**
 * Delete migrated Gestion for phone 5492984252859
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import GestionModel from '../models/gestion';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://kriquelme10_db_user:sUBCG6imJ3gcRzCI@cluster0.1grzrfe.mongodb.net/test?appName=Cluster0';

async function fix() {
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB\n');

  const phone = '5492984252859';
  
  const result = await GestionModel.deleteOne({ phone });
  console.log(`🗑️  Deleted ${result.deletedCount} Gestion(s) for phone ${phone}`);

  await mongoose.disconnect();
}

fix().catch(console.error);