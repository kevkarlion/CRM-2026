/**
 * Debug: Check what exists for phone 5492984252859
 */

import 'dotenv/config';
import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://kriquelme10_db_user:sUBCG6imJ3gcRzCI@cluster0.1grzrfe.mongodb.net/test?appName=Cluster0';

async function debug() {
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB\n');

  const phone = '5492984252859';
  const normalized = phone.replace(/[\s\-\(\)\+]/g, '');

  // Check Clients
  const { default: ClientModel } = await import('../../crm/models/client');
  const clients = await ClientModel.find({ 
    $or: [
      { phone },
      { phone: normalized },
      { phone: { $regex: normalized.slice(-9) } }
    ]
  }).lean();
  console.log('📱 Clients:', clients.length);
  for (const c of clients) {
    console.log(`   - ${c.fullName || c.companyName} | phone: ${c.phone}`);
  }

  // Check Gestiones
  const { default: GestionModel } = await import('../models/gestion');
  const gestions = await GestionModel.find({
    $or: [
      { phone: phone },
      { phone: normalized },
      { phone: { $regex: normalized.slice(-9) } }
    ]
  }).lean();
  console.log('\n📱 Gestiones:', gestions.length);
  for (const g of gestions) {
    console.log(`   - ${g.name} | status: ${g.status} | phone: ${g.phone}`);
  }

  // Check Leads
  const { default: LeadModel } = await import('../../leads/models/lead');
  const leads = await LeadModel.find({
    $or: [
      { phone: phone },
      { phone: normalized },
      { phone: { $regex: normalized.slice(-9) } }
    ]
  }).lean();
  console.log('\n📱 Leads:', leads.length);
  for (const l of leads) {
    console.log(`   - ${l.name} | status: ${l.status} | phone: ${l.phone}`);
  }

  await mongoose.disconnect();
}

debug().catch(console.error);