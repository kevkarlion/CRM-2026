/**
 * Debug: Find client by phone 5492996313141
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import ClientModel from '../../crm/models/client';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://kriquelme10_db_user:sUBCG6imJ3gcRzCI@cluster0.1grzrfe.mongodb.net/test?appName=Cluster0';

function normalizePhone(phone: string): string {
  return phone.replace(/[\s\-\(\)\+]/g, '').replace(/^0/, '');
}

async function debug() {
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB\n');

  const phone = '5492996313141';
  const normalizedPhone = normalizePhone(phone);
  
  // Find by exact phone or normalized
  const client = await ClientModel.findOne({
    $or: [
      { phone: phone },
      { phone: normalizedPhone },
      { phone: { $regex: normalizedPhone.slice(-10) } },
    ]
  }).lean();
  
  console.log('📱 Client found:', client);
  console.log('   Name:', client?.fullName || client?.companyName);
  console.log('   Phone:', client?.phone);

  await mongoose.disconnect();
}

debug().catch(console.error);