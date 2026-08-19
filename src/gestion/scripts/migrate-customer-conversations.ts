/**
 * Migrate customer conversations to Gestion entities
 * 
 * Run: npx tsx src/gestion/scripts/migrate-customer-conversations.ts
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import ClientModel from '../../crm/models/client';
import GestionModel from '../models/gestion';
import ConversationModel from '../../conversation/models/conversation';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://kriquelme10_db_user:sUBCG6imJ3gcRzCI@cluster0.1grzrfe.mongodb.net/test?appName=Cluster0';

function normalizePhone(phone: string): string {
  return phone.replace(/[\s\-\(\)\+]/g, '').replace(/^0/, '');
}

async function migrate() {
  console.log('🔄 Starting migration: Customer Conversations -> Gestiones\n');
  
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB\n');

  console.log('📥 Fetching customer conversations from MongoDB...');
  
  const conversations = await ConversationModel.find({
    conversationType: 'customer',
    lifecycleState: { $in: ['ACTIVE_CLIENT', 'WAITING_CLIENT', 'IN_PROGRESS'] },
  }).lean();

  console.log(`   Found ${conversations.length} conversations\n`);

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const conv of conversations) {
    try {
      const phoneNumber = conv.phoneNumber;
      const normalizedPhone = normalizePhone(phoneNumber);

      // Find client by phone
      const client = await ClientModel.findOne({
        $or: [
          { phone: phoneNumber },
          { phone: normalizedPhone },
          { phone: { $regex: normalizedPhone.slice(-9) } }, // Last 9 digits
        ],
        deletedAt: null,
      });

      if (!client) {
        console.log(`   ⚠️  Client not found for phone: ${phoneNumber}`);
        errors++;
        continue;
      }

      console.log(`   📱 Found client: ${client.name} (${client._id}) for phone ${phoneNumber}`);

      // Check if client already has an active Gestion
      const existingGestion = await GestionModel.findOne({
        clientId: client._id,
        status: { $nin: ['won', 'lost'] },
        deletedAt: null,
      });

      if (existingGestion) {
        console.log(`   ⏭️  Skipping ${client.name} - already has active Gestion`);
        skipped++;
        continue;
      }

      // Map lifecycleState to Gestion status
      let status: 'new' | 'contacted' | 'qualified' | 'proposal' | 'negotiation' = 'new';
      if (conv.lifecycleState === 'ACTIVE_CLIENT' || conv.lifecycleState === 'IN_PROGRESS') {
        status = 'contacted';
      }

      // Map waitingPriority to Gestion priority
      let priority: 'high' | 'medium' | 'low' = 'medium';
      if (conv.waitingPriority === 'high') priority = 'high';
      else if (conv.waitingPriority === 'medium') priority = 'medium';
      else priority = 'low';

      // Create Gestion
      const gestion = await GestionModel.create({
        tenantId: client.tenantId,
        clientId: client._id,
        name: client.name || 'Cliente',
        phone: client.phone || phoneNumber,
        source: 'whatsapp',
        status,
        priority,
        score: 0,
        temperature: 'cold',
        notes: `Migrated from conversation ${conv._id}. Owner: ${conv.owner}. Last message: ${conv.lastMessageAt}`,
        assignedTo: conv.assignedToUserId,
        createdBy: 'migration-script',
        updatedBy: 'migration-script',
      });

      console.log(`   ✅ Created Gestion for ${client.name} (status: ${status}, priority: ${priority})`);
      created++;
    } catch (err) {
      console.log(`   ❌ Error:`, err instanceof Error ? err.message : err);
      errors++;
    }
  }

  console.log('\n📊 Migration Summary:');
  console.log(`   ✅ Created: ${created}`);
  console.log(`   ⏭️  Skipped (already has Gestion): ${skipped}`);
  console.log(`   ❌ Errors: ${errors}`);
  
  await mongoose.disconnect();
  console.log('\n🔌 Disconnected from MongoDB');
  
  if (created > 0) {
    console.log('\n✨ Migration complete!');
  }
}

migrate().catch(console.error);