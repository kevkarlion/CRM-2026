import { config } from 'dotenv';
config({ path: '.env.local' });

import mongoose from 'mongoose';
import { connectDB } from '../src/core/db';
import ClientModel from '../src/crm/models/client';
import GestionModel from '../src/gestion/models/gestion';
import ContactModel from '../src/crm/models/contact';
import ConversationModel from '../src/conversation/models/conversation';

/**
 * Corrección post-carga masiva de clientes (import-clientes.ts --run).
 *
 *  1. ELIMINA los clientes importados que DUPLICAN a clientes previos
 *     (mismo número local vs previo con prefijo 549) — 11 detectados,
 *     todos sin conversaciones ni mensajes (recién creados por el import).
 *  2. BACKFILL de prefijo 549 a los clientes importados que quedaron con
 *     teléfono local de 10 dígitos, sincronizando Client + Contact + Conversation.
 *  3. EXCLUYE DIANA BERTON (2995009254): colisiona con FERNANDO VILLAR
 *     (5492995009254) — pendiente resolver qué cliente queda. Al ejecutar
 *     sin --exclude-diana, DIANA se excluye automáticamente de la sincronización.
 *
 * Uso:
 *   npx tsx scripts/fix-import-phones.ts --dry
 *   npx tsx scripts/fix-import-phones.ts --run
 */

const TENANT_ID = new mongoose.Types.ObjectId('6a45a83e202f4857cebf0e72');
const EXCLUDE_DIANA = true; // pendiente resolver par interno DIANA/FERNANDO

const isDry = process.argv.includes('--dry');
const isRun = process.argv.includes('--run');

if (!isDry && !isRun) {
  console.error('Uso: --dry (solo ver) | --run (ejecutar)');
  process.exit(1);
}

function last10(p: string): string {
  return String(p).replace(/\D/g, '').slice(-10);
}

async function main() {
  await connectDB();
  console.log(`Modo: ${isRun ? 'RUN' : 'DRY'}`);

  const all = await ClientModel.find({ tenantId: TENANT_ID, deletedAt: null }).lean();
  const importados = all.filter((c: any) => c.source === 'other');
  const previos = all.filter((c: any) => c.source !== 'other');

  // --- FASE 1: duplicados vs previos --------------------------------------
  const prevByLast10 = new Map<string, any[]>();
  for (const c of previos) {
    const l10 = last10(String(c.phone || ''));
    if (l10.length === 10) {
      if (!prevByLast10.has(l10)) prevByLast10.set(l10, []);
      prevByLast10.get(l10)!.push(c);
    }
  }

  const dups = importados.filter((c: any) => {
    const l10 = last10(String(c.phone || ''));
    return l10.length === 10 && prevByLast10.has(l10);
  });
  console.log(`\n[FASE 1] Duplicados vs previos: ${dups.length}`);
  for (const c of dups) {
    console.log(`  - ${String(c.fullName || c.companyName).slice(0, 42)} phone=${c.phone} id=${c._id}`);
  }

  // --- FASE 2: backfill de prefijo ---------------------------------------
  const dupIds = new Set(dups.map((c: any) => String(c._id)));
  const candidates = importados.filter((c: any) => {
    if (dupIds.has(String(c._id))) return false;
    const p = String(c.phone || '');
    if (!/^\d{10}$/.test(p) || p.startsWith('54')) return false;
    if (p.startsWith('800')) return false; // línea 0800, no se toca
    if (EXCLUDE_DIANA && last10(p) === '2995009254') return false; // par interno pendiente
    return true;
  });
  console.log(`\n[FASE 2] Backfill a 549: ${candidates.length} clientes`);

  const byPhone = new Map<string, { old: string; new: string }[]>();
  for (const c of candidates) {
    const old = String(c.phone);
    const nw = '549' + old;
    if (!byPhone.has(old)) byPhone.set(old, []);
    byPhone.get(old)!.push({ old, new: nw });
  }
  console.log(`  Teléfonos únicos a actualizar: ${byPhone.size}`);

  // Verificar colisiones futuras contra lo que queda
  const survivors = new Set([
    ...previos.map((c: any) => String(c.phone || '')),
    ...importados.filter((c: any) => !candidates.some((x: any) => String(x._id) === String(c._id))).map((c: any) => String(c.phone || '')),
  ]);
  const collisions: string[] = [];
  for (const [old, list] of byPhone) {
    for (const { new: nw } of list) {
      if (survivors.has(nw)) collisions.push(nw);
    }
  }
  console.log(`  Colisiones post-cambio: ${collisions.length} ${collisions.slice(0, 3)}`);

  // Contact/Conversation impactados
  for (const [old, list] of [...byPhone.entries()].slice(0, 3)) {
    console.log(`  - ${list.length} cliente(s) ${old} -> 549${old}`);
  }

  if (isRun) {
    // --- FASE 1: eliminar duplicados (cliente + gestión + contacto) --------
    let deletedClients = 0, deletedGestiones = 0, deletedContacts = 0;
    for (const c of dups) {
      const id = c._id as any;
      const glob = await GestionModel.deleteMany({ tenantId: TENANT_ID, clientId: id });
      const cli = await ContactModel.deleteMany({ tenantId: TENANT_ID, clientId: id });
      const cld = await ClientModel.deleteOne({ _id: id });
      deletedGestiones += glob.deletedCount ?? 0;
      deletedContacts += cli.deletedCount ?? 0;
      deletedClients += cld.deletedCount ?? 0;
    }
    console.log(`\n[FASE 1] Eliminados: clientes=${deletedClients} gestiones=${deletedGestiones} contactos=${deletedContacts}`);

    // --- FASE 2: actualizar Client + Contact + Conversation ----------------
    let updatedClients = 0, updatedContacts = 0, updatedConvs = 0;
    for (const [old, list] of byPhone) {
      const nw = list[0].new;
      const clientIds = list.map((x) => x.old).length; // placeholder

      // Client
      const r1 = await ClientModel.updateOne(
        { tenantId: TENANT_ID, phone: old, deletedAt: null },
        { $set: { phone: nw } }
      );
      updatedClients += r1.modifiedCount ?? 0;

      // Contact del/los cliente(s) con ese phone
      const clientDocs = await ClientModel.find({ tenantId: TENANT_ID, phone: old, deletedAt: null }).select('_id').lean();
      const cids = clientDocs.map((x: any) => x._id);
      const r2 = await ContactModel.updateMany(
        { tenantId: TENANT_ID, clientId: { $in: cids }, deletedAt: null },
        { $set: { phone: nw } }
      );
      updatedContacts += r2.modifiedCount ?? 0;

      // Conversation por phoneNumber
      const r3 = await ConversationModel.updateMany(
        { tenantId: TENANT_ID, phoneNumber: old },
        { $set: { phoneNumber: nw } }
      );
      updatedConvs += r3.modifiedCount ?? 0;
    }
    console.log(`[FASE 2] Actualizados: clients=${updatedClients} contacts=${updatedContacts} conversations=${updatedConvs}`);
  }

  console.log('\nOK');
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
