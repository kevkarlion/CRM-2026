/**
 * Script para limpiar datos de conversación, lead y cliente por número de teléfono.
 * 
 * Uso:
 *   npx tsx scripts/db-cleanup.ts +5492984252859           # borrar todo
 *   npx tsx scripts/db-cleanup.ts +5492984252859 --dry-run # solo mostrar qué borraría
 *   npx tsx scripts/db-cleanup.ts +5492984252859 --whatsapp   # solo whatsappmessages
 *   npx tsx scripts/db-cleanup.ts +5492984252859 --leads       # solo leads
 *   npx tsx scripts/db-cleanup.ts +5492984252859 --conversations # solo conversations
 *   npx tsx scripts/db-cleanup.ts +5492984252859 --clients     # solo clients
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import mongoose from 'mongoose';

const MONGO_URI = process.env.MONGODB_URI;

if (!MONGO_URI) {
  console.error('❌ Error: No se encontró la variable de entorno MONGODB_URI');
  process.exit(1);
}

// Parsear argumentos
const args = process.argv.slice(2);
const phoneNumber = args[0]?.replace(/^0/, '+54'); // Normalizar: 549... -> +549...
const options = args.slice(1);

if (!phoneNumber) {
  console.error('❌ Uso: npx tsx scripts/db-cleanup.ts <numero> [opciones]');
  console.error('   Ejemplo: npx tsx scripts/db-cleanup.ts 5492984252859');
  console.error('   Opciones: --dry-run, --whatsapp, --leads, --conversations, --clients');
  process.exit(1);
}

// Normalizar: +549... -> 549... para buscar en la DB
const normalizedPhone = phoneNumber.replace(/^\+54/, '54').replace(/^0/, '');

const dryRun = options.includes('--dry-run');

// Si no se especifica ninguna colección, hacer todas
// Si se especifica alguna, hacer solo esas
const hasAnyCollection = options.some(o => ['--whatsapp', '--leads', '--conversations', '--clients'].includes(o));

const doWhatsApp = !hasAnyCollection || options.includes('--whatsapp');
const doLeads = !hasAnyCollection || options.includes('--leads');
const doConversations = !hasAnyCollection || options.includes('--conversations');
const doClients = !hasAnyCollection || options.includes(--clients);

async function cleanup() {
  console.log('🔌 Conectando a MongoDB...');
  await mongoose.connect(MONGO_URI);
  console.log('✅ Conectado\n');

  const db = mongoose.connection.db;
  
  console.log(`📱 Teléfono: ${phoneNumber}`);
  console.log(`📱 Normalizado: ${normalizedPhone}`);
  console.log(`🔍 dry-run: ${dryRun}\n`);

  const results: { collection: string; deleted: number }[] = [];

  // 1. WhatsApp Messages
  if (doWhatsApp) {
    const collection = db.collection('whatsappmessages');
    const query = { phone: normalizedPhone };
    const count = await collection.countDocuments(query);
    
    if (count > 0) {
      if (!dryRun) {
        const result = await collection.deleteMany(query);
        results.push({ collection: 'whatsappmessages', deleted: result.deletedCount });
        console.log(`🗑️  whatsappmessages: ${result.deletedCount} documentos borrados`);
      } else {
        console.log(`🔍 whatsappmessages: ${count} documentos`);
      }
    } else {
      console.log(`✅ whatsappmessages: 0 documentos`);
    }
  }

  // 2. Leads
  if (doLeads) {
    const collection = db.collection('leads');
    const query = { phone: normalizedPhone };
    const count = await collection.countDocuments(query);
    
    if (count > 0) {
      if (!dryRun) {
        const result = await collection.deleteMany(query);
        results.push({ collection: 'leads', deleted: result.deletedCount });
        console.log(`🗑️  leads: ${result.deletedCount} documentos borrados`);
      } else {
        console.log(`🔍 leads: ${count} documentos`);
      }
    } else {
      console.log(`✅ leads: 0 documentos`);
    }
  }

  // 3. Conversations (phoneNumber field)
  if (doConversations) {
    const collection = db.collection('conversations');
    const query = { phoneNumber: normalizedPhone };
    const count = await collection.countDocuments(query);
    
    if (count > 0) {
      if (!dryRun) {
        const result = await collection.deleteMany(query);
        results.push({ collection: 'conversations', deleted: result.deletedCount });
        console.log(`🗑️  conversations: ${result.deletedCount} documentos borrados`);
      } else {
        console.log(`🔍 conversations: ${count} documentos`);
      }
    } else {
      console.log(`✅ conversations: 0 documentos`);
    }
  }

  // 4. Clients (phone field)
  if (doClients) {
    const collection = db.collection('clients');
    const query = { phone: normalizedPhone };
    const count = await collection.countDocuments(query);
    
    if (count > 0) {
      if (!dryRun) {
        const result = await collection.deleteMany(query);
        results.push({ collection: 'clients', deleted: result.deletedCount });
        console.log(`🗑️  clients: ${result.deletedCount} documentos borrados`);
      } else {
        console.log(`🔍 clients: ${count} documentos`);
      }
    } else {
      console.log(`✅ clients: 0 documentos`);
    }
  }

  if (dryRun) {
    console.log('\n⚠️  [DRY RUN] No se borró nada. Quita --dry-run para ejecutar.');
  }

  const totalDeleted = results.reduce((sum, r) => sum + r.deleted, 0);
  console.log(`\n📊 Total: ${dryRun ? 'encontrados' : 'borrados'} ${totalDeleted} documentos`);

  await mongoose.disconnect();
  console.log('\n🔌 Desconectado');
}

cleanup().catch(console.error);
