import mongoose from 'mongoose';

/**
 * Lista números de teléfono "raros" en Clientes y Leads para revisión manual.
 *
 * DRY-ONLY: NO modifica ni borra NADA. Solo lista candidatos.
 *
 * Un número se considera sospechoso cuando NO tiene el prefijo 549 que espera
 * WhatsApp para Argentina, por ejemplo números de 10 dígitos guardados antes
 * del fix de normalización (ej: 2996300680 → debería ser 5492996300680).
 *
 * Uso (desde la raíz del repo, con tsx):
 *   npx tsx scripts/list-suspicious-phones.ts
 *
 * Flags opcionales:
 *   --include-landline   incluir también números de 10 dígitos (posibles fijos)
 *                        Por defecto solo muestra números que NO empiezan con 54
 *                        (que son claramente incompletos para WhatsApp).
 */

const MONGO_URI =
  process.env.MONGO_URI ||
  'mongodb+srv://kriquelme10_db_user:sUBCG6imJ3gcRzCI@cluster0.1grzrfe.mongodb.net/test?appName=Cluster0';

function digitsOnly(phone: string | undefined | null): string {
  return (phone || '').replace(/[^\d]/g, '');
}

/**
 * Clasifica un número para decidir si es "sospechoso" (necesita revisión).
 * - WhatsApp para Argentina espera 549 + 10 dígitos (12 total) o 54 + 11.
 * - Números de 10 dígitos SIN 549 son los que quedaron mal guardados.
 */
function isSuspicious(phone: string | undefined | null): boolean {
  if (!phone) return false;
  const d = digitsOnly(phone);
  if (!d) return false;
  // Ya tiene código de país argentino → ok
  if (d.startsWith('54')) return false;
  // 10 dígitos sin 549 → sospechoso (falta prefijo)
  if (d.length === 10) return true;
  // 9 dígitos que no empiezan con 9 → rarísimo
  if (d.length === 9 && !d.startsWith('9')) return true;
  // Otros largos inusuales
  if (d.length < 9 || d.length > 13) return true;
  return false;
}

async function main() {
  const includeLandline = process.argv.includes('--include-landline');

  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;

  console.log('🔍 Buscando números sospechosos en Clientes y Leads...\n');

  const suspiciousClients: any[] = [];
  const suspiciousLeads: any[] = [];

  const clients = await db
    .collection('clients')
    .find({ deletedAt: null })
    .project({ _id: 1, fullName: 1, companyName: 1, phone: 1, email: 1, status: 1 })
    .toArray();

  for (const c of clients) {
    if (isSuspicious(c.phone)) {
      suspiciousClients.push(c);
    }
  }

  const leads = await db
    .collection('leads')
    .find({ deletedAt: null })
    .project({ _id: 1, name: 1, phone: 1, email: 1, status: 1 })
    .toArray();

  for (const l of leads) {
    if (isSuspicious(l.phone)) {
      suspiciousLeads.push(l);
    }
  }

  console.log(`=== CLIENTES sospechosos (${suspiciousClients.length}) ===\n`);
  if (suspiciousClients.length === 0) {
    console.log('  (ninguno)\n');
  } else {
    for (const c of suspiciousClients) {
      const name = c.companyName || c.fullName || '(sin nombre)';
      console.log(`  👤 ${name}`);
      console.log(`     ID:    ${c._id}`);
      console.log(`     Phone: ${c.phone || '(vacío)'}`);
      console.log(`     Email: ${c.email || '-'}`);
      console.log(`     Sugerido: 549${digitsOnly(c.phone)}`);
      console.log('');
    }
  }

  console.log(`=== LEADS sospechosos (${suspiciousLeads.length}) ===\n`);
  if (suspiciousLeads.length === 0) {
    console.log('  (ninguno)\n');
  } else {
    for (const l of suspiciousLeads) {
      console.log(`  🧍 ${l.name || '(sin nombre)'}`);
      console.log(`     ID:    ${l._id}`);
      console.log(`     Phone: ${l.phone || '(vacío)'}`);
      console.log(`     Email: ${l.email || '-'}`);
      console.log(`     Status: ${l.status || '-'}`);
      console.log(`     Sugerido: 549${digitsOnly(l.phone)}`);
      console.log('');
    }
  }

  const total = suspiciousClients.length + suspiciousLeads.length;
  console.log('------------------------------------------------');
  console.log(`Total: ${total} número(s) sospechoso(s).`);
  console.log('');
  console.log('¿Cómo arreglarlos?');
  console.log('  1. Abrí el cliente/lead en el CRM');
  console.log('  2. Editalo y cambiá el teléfono al formato "Sugerido" (con 549)');
  console.log('  3. Guardá. El sistema lo normaliza correctamente.');
  console.log('');
  console.log('[DRY] No se modificó nada. Solo se listaron candidatos.');

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error('Error:', e);
  process.exit(1);
});
