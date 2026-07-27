/**
 * Test script: Emula el flujo completo del bot de WhatsApp
 * 
 * Simula un lead nuevo que escribe por WhatsApp y pasa por todos
 * los estados de la conversación hasta llegar a "contactado".
 * 
 * Uso: npx tsx scripts/test-bot-flow.ts
 */

import { connectDB } from '../src/core/db';
import { processWhatsAppWebhookMessage } from '../src/conversation/infrastructure/webhook-integration';
import ConversationModel from '../src/conversation/models/conversation';
import LeadModel from '../src/leads/models/lead';

const TEST_PHONE = '+5491155559999';
const TEST_TENANT_ID = '6a45a83e202f4857cebf0e72'; // Demo Corp
const TEST_NAME = 'Juan Pérez (Test Bot)';

interface TestStep {
  description: string;
  message: string;
  expectedState?: string;
}

const TEST_FLOW: TestStep[] = [
  {
    description: '1️⃣  Saludo inicial - Lead nuevo escribe "Hola"',
    message: 'Hola',
    expectedState: 'need_type_asked',
  },
  {
    description: '2️⃣  Tipo de servicio - Responde "necesito reparación urgente"',
    message: 'Necesito una reparación urgente, mi aire no enfría',
    expectedState: 'urgency_asked', // Skip detail_asked because message has enough data
  },
  {
    description: '3️⃣  Urgencia - Responde "hoy"',
    message: 'Es para hoy, hace mucho calor',
    expectedState: 'location_asked',
  },
  {
    description: '4️⃣  Ubicación - Da ubicación',
    message: 'Estoy en Palermo, Buenos Aires',
    expectedState: 'equipment_asked',
  },
  {
    description: '5️⃣  Tipo de equipo - Especifica equipo',
    message: 'Es un aire acondicionado split',
    expectedState: 'scored', // Should evaluate and score
  },
];

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function printConversationState(leadId: string) {
  const conversation = await ConversationModel.findOne({ leadId }).sort({ createdAt: -1 });
  const lead = await LeadModel.findById(leadId);

  if (!conversation) {
    console.log('  ❌ No se encontró conversación');
    return;
  }

  console.log(`  📊 Estado: ${conversation.state}`);
  console.log(`  🤖 Bot activo: ${['greeting', 'need_type_asked', 'need_type_captured', 'detail_asked', 'detail_captured', 'urgency_asked', 'urgency_captured', 'location_asked', 'location_captured', 'equipment_asked', 'equipment_captured', 'evaluate', 'scored'].includes(conversation.state) ? 'SÍ' : 'NO'}`);
  console.log(`  📝 Step: ${conversation.step}`);
  console.log(`  🔄 Fallbacks: ${conversation.fallbackCount}`);
  
  if (conversation.context) {
    const ctx = conversation.context as any;
    console.log(`  📋 Contexto:`);
    if (ctx.needType) console.log(`     - Necesidad: ${ctx.needType}`);
    if (ctx.urgency) console.log(`     - Urgencia: ${ctx.urgency}`);
    if (ctx.location) console.log(`     - Ubicación: ${ctx.location}`);
    if (ctx.equipmentType) console.log(`     - Equipo: ${ctx.equipmentType}`);
    if (ctx.customerType) console.log(`     - Tipo cliente: ${ctx.customerType}`);
    if (ctx.hasEmergencyKeywords) console.log(`     - ⚠️ Keywords de emergencia detectadas`);
  }

  if (lead) {
    console.log(`  🌡️ Lead score: ${lead.score || 0}`);
    console.log(`  🌡️ Lead temperature: ${lead.temperature || 'sin clasificar'}`);
    console.log(`  📌 Lead status: ${lead.status}`);
  }
}

async function runTest() {
  console.log('🧪 ========================================');
  console.log('   TEST: Flujo completo del Bot WhatsApp');
  console.log('==========================================\n');

  // Connect to DB
  console.log('📦 Conectando a MongoDB...');
  await connectDB();
  console.log('✅ Conectado\n');

  // Clean up previous test data
  console.log('🧹 Limpiando datos de test anteriores...');
  await ConversationModel.deleteMany({ leadId: { $exists: true } });
  
  // Find and delete existing test lead
  const existingLead = await LeadModel.findOne({ phone: { $regex: /5491155559999/ } });
  if (existingLead) {
    await ConversationModel.deleteMany({ leadId: existingLead._id });
    await LeadModel.findByIdAndDelete(existingLead._id);
    console.log('   Lead de test anterior eliminado');
  }
  console.log('✅ Limpio\n');

  let leadId = '';

  for (const step of TEST_FLOW) {
    console.log(step.description);
    console.log(`  📤 Mensaje: "${step.message}"`);

    try {
      const result = await processWhatsAppWebhookMessage({
        tenantId: TEST_TENANT_ID,
        phone: TEST_PHONE,
        messageContent: step.message,
        pushName: TEST_NAME,
        messageId: `wamid.test.${Date.now()}`,
      });

      leadId = result.leadId;
      
      console.log(`  ✅ Procesado (${result.actions.length} acciones)`);
      
      if (result.replyContent) {
        console.log(`  🤖 Bot responde: "${result.replyContent}"`);
      }

      // Show actions
      for (const action of result.actions) {
        if (action.type === 'update_lead') {
          console.log(`  📝 Lead actualizado: score=${(action as any).updates?.score}, temp=${(action as any).updates?.temperature}`);
        }
        if (action.type === 'trigger_handoff') {
          console.log(`  🔀 HANDOFF: ${(action as any).reason}`);
        }
        if (action.type === 'close_conversation') {
          console.log(`  ✅ Conversación cerrada`);
        }
      }

      // Print conversation state
      await printConversationState(leadId);

      if (step.expectedState) {
        const conversation = await ConversationModel.findOne({ leadId }).sort({ createdAt: -1 });
        if (conversation && conversation.state !== step.expectedState) {
          console.log(`  ⚠️  Estado esperado: ${step.expectedState}, actual: ${conversation.state}`);
        }
      }

    } catch (error) {
      console.log(`  ❌ Error: ${error}`);
    }

    console.log('');
    await sleep(500); // Small delay between messages
  }

  // Final summary
  console.log('==========================================');
  console.log('📊 RESUMEN FINAL');
  console.log('==========================================');
  
  if (leadId) {
    await printConversationState(leadId);
    
    const lead = await LeadModel.findById(leadId);
    if (lead) {
      console.log('\n🎯 Estado del Lead:');
      console.log(`   Nombre: ${lead.name}`);
      console.log(`   Teléfono: ${lead.phone}`);
      console.log(`   Status: ${lead.status}`);
      console.log(`   Score: ${lead.score || 0}`);
      console.log(`   Temperature: ${lead.temperature || 'sin clasificar'}`);
      console.log(`   Source: ${lead.source}`);
      if (lead.inquiryReason) console.log(`   Inquiry Reason: ${lead.inquiryReason}`);
      if (lead.customerType) console.log(`   Customer Type: ${lead.customerType}`);
    }
  }

  console.log('\n✅ Test completado');
  process.exit(0);
}

runTest().catch((error) => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
