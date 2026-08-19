/**
 * Fix: Update Gestion names from client data
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import GestionModel from '../models/gestion';
import ClientModel from '../../crm/models/client';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://kriquelme10_db_user:sUBCG6imJ3gcRzCI@cluster0.1grzrfe.mongodb.net/test?appName=Cluster0';

async function fix() {
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB\n');

  const gestions = await GestionModel.find().lean();

  for (const g of gestions) {
    const client = await ClientModel.findById(g.clientId).lean();
    if (client) {
      const name = client.companyName || client.fullName || 'Cliente';
      await GestionModel.updateOne(
        { _id: g._id },
        { $set: { name } }
      );
      console.log(`   ✅ Updated: ${g.phone} -> ${name}`);
    }
  }

  console.log('\n✨ Done!');
  await mongoose.disconnect();
}

fix().catch(console.error);