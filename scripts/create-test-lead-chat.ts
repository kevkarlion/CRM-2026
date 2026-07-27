import { connectDB } from '../src/core/db';
import WhatsAppMessageModel from '../src/crm/models/whatsapp-message';
import LeadModel from '../src/leads/models/lead';
import { Types } from 'mongoose';

async function main() {
  await connectDB();

  const tenantId = '000000000000000000000001';

  // Create message
  const msg = await WhatsAppMessageModel.create({
    tenantId: new Types.ObjectId(tenantId),
    phone: '5491166699911',
    messageId: 'wamid.test789',
    direction: 'inbound',
    type: 'text',
    content: 'Hola, quiero info de servicios',
    status: 'delivered',
  });

  // Create or get lead
  let lead = await LeadModel.findOne({ phone: '5491166699911', tenantId: new Types.ObjectId(tenantId) });
  if (!lead) {
    lead = await LeadModel.create({
      tenantId: new Types.ObjectId(tenantId),
      name: 'Maria Garcia',
      phone: '5491166699911',
      source: 'whatsapp',
      status: 'new',
      notes: 'Lead desde WhatsApp',
    });
  }

  // Update message with lead
  msg.leadId = lead._id;
  await msg.save();

  console.log('Message created:', msg._id);
  console.log('Lead:', lead.name);
  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});