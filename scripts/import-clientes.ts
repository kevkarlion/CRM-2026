import { config } from 'dotenv';
config({ path: '.env.local' });

import mongoose from 'mongoose';
import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { connectDB } from '../src/core/db';
import ClientModel from '../src/crm/models/client';
import GestionModel from '../src/gestion/models/gestion';
import ContactModel from '../src/crm/models/contact';
import ConversationModel from '../src/conversation/models/conversation';
import UserModel from '../src/core/models/user';
import { LeadModel } from '../src/leads/models';
import { normalizePhone } from '../src/lib/phone';

/**
 * Importación masiva de clientes desde el reporte exportado
 * "Clientes _ Listado de clientes.xls" (sistema de facturación).
 *
 * Por cada cliente CON TELÉFONO crea:
 *   1. Client        (dedupe por {tenantId, phone} — índice único de Mongo)
 *   2. Gestion       (solo si no hay gestión activa) — name = companyName || fullName
 *   3. Contact       (upsert por {tenantId, phone}) — eslabón WhatsApp
 *   4. Conversation  (solo si no existe por phoneNumber) — vacía ACTIVE_CLIENT
 *
 * Uso:
 *   npx tsx scripts/import-clientes.ts --dry          # muestra qué haría
 *   npx tsx scripts/import-clientes.ts --run          # ejecuta
 *   npx tsx scripts/import-clientes.ts --dry --file <path.xls>
 *
 * Flags:
 *   --dry | --run      (obligatorio elegir uno)
 *   --file <path>      ruta del .xls (default: documentos/Clientes _ Listado de clientes.xls)
 *   --tenant <id>      tenantId (default: 6a45a83e202f4857cebf0e72)
 *   --user <id>        createdBy/updatedBy (default: devwebpatagonia 6a7f070120b843b932678970)
 *   --batch <n>        batch size (default: 20)
 */

interface ExcelRow {
  idx: number;
  name: string;
  razon: string;
  phone: string;
  iva: string;
  doc: string;
  dom: string;
}

interface ParsedAddress {
  address: string;
  locality: string;
  province: string;
}

const DEFAULT_FILE = path.resolve(process.cwd(), 'documentos/Clientes _ Listado de clientes.xls');
const DEFAULT_TENANT = '6a45a83e202f4857cebf0e72';
const DEFAULT_USER = '6a7f070120b843b932678970'; // devwebpatagonia@gmail.com

// ---------------------------------------------------------------------------
// Parsing del .xls
// ---------------------------------------------------------------------------

function isNameRow(row: unknown[]): boolean {
  return /^\d+\s*-\s/.test(String(row[1] || '').trim());
}

function parseNameCell(cell: string): { name: string; razon: string } | null {
  const m = cell.match(/^\d+\s*-\s*(.*?)\s*\((.*)\)\s*$/);
  if (!m) return null;
  return { name: m[1].trim(), razon: m[2].trim() };
}

function parseSheet(filePath: string): ExcelRow[] {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Archivo no encontrado: ${filePath}`);
  }
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' });

  const rows: ExcelRow[] = [];
  for (let i = 10; i < data.length; i++) {
    const cell = String(data[i][1] || '').trim();
    if (!isNameRow(data[i])) continue;
    const parsed = parseNameCell(cell);
    if (!parsed) continue;

    // Domicilio: fila siguiente no vacía en las próximas 3
    let dom = '';
    for (let j = i + 1; j <= i + 3 && j < data.length; j++) {
      const c = String(data[j][1] || '').trim();
      if (c && !isNameRow(data[j])) {
        dom = c;
        break;
      }
    }

    rows.push({
      idx: i,
      name: parsed.name,
      razon: parsed.razon,
      phone: String(data[i][3] || '').trim(),
      iva: String(data[i][5] || '').trim(),
      doc: String(data[i][6] || '').trim(),
      dom,
    });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Datos de negocio
// ---------------------------------------------------------------------------

/** Separa "CALLE, Localidad, PROVINCIA" — heurística robusta para este reporte. */
function parseAddress(dom: string): ParsedAddress {
  if (!dom) return { address: '', locality: '', province: '' };
  const parts = dom.split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.length === 1) {
    // Solo calle — sin localidad/provincia
    return { address: parts[0], locality: '', province: '' };
  }
  const province = parts[parts.length - 1];
  const locality = parts.length >= 3 ? parts[parts.length - 2] : '';
  // Todo lo anterior (puede tener comas internas del tipo "TORRE1, P3, DPTO B") es la calle
  const address = parts.slice(0, parts.length - (parts.length >= 3 ? 2 : 1)).join(', ');
  return { address, locality, province };
}

function customerTypeFromIva(iva: string): 'residential' | 'commercial' {
  return iva === 'CF' ? 'residential' : 'commercial';
}

function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  const firstName = parts[0] || 'Cliente';
  const lastName = parts.slice(1).join(' ') || '';
  return { firstName, lastName };
}

/** Detecta teléfonos duplicados dentro del propio archivo (listas de índices por phone normalizado). */
function findInternalPhoneDuplicates(rows: ExcelRow[]): Map<string, ExcelRow[]> {
  const byPhone = new Map<string, ExcelRow[]>();
  for (const r of rows) {
    const p = normalizePhone(r.phone);
    if (!p) continue;
    const arr = byPhone.get(p) || [];
    arr.push(r);
    byPhone.set(p, arr);
  }
  const dups = new Map<string, ExcelRow[]>();
  for (const [p, arr] of byPhone) {
    if (arr.length > 1) dups.set(p, arr);
  }
  return dups;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function parseArgs(argv: string[]) {
  const get = (flag: string) => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  return {
    dry: argv.includes('--dry'),
    run: argv.includes('--run'),
    file: get('--file'),
    tenant: get('--tenant'),
    user: get('--user'),
    batch: parseInt(get('--batch') || '20', 10),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.dry && !args.run) {
    console.error('Error: indicá --dry o --run');
    process.exit(1);
  }
  if (args.dry && args.run) {
    console.error('Error: elegí --dry O --run, no ambos');
    process.exit(1);
  }

  const filePath = args.file ? path.resolve(args.file) : DEFAULT_FILE;
  const tenantId = args.tenant || DEFAULT_TENANT;
  const userId = args.user || DEFAULT_USER;

  console.log(`Archivo : ${filePath}`);
  console.log(`Tenant  : ${tenantId}`);
  console.log(`Usuario : ${userId}`);
  console.log(`Modo    : ${args.dry ? 'DRY (no toca nada)' : 'RUN (ejecuta)'}\n`);

  await connectDB();

  // Resolver el usuario creador
  const user = await UserModel.findById(userId).lean();
  if (!user) {
    console.error(`ERROR: no existe el usuario ${userId}. Pasá uno válido con --user <id>`);
    process.exit(1);
  }
  console.log(`Creador : ${user.firstName || ''} ${user.lastName || ''} <${user.email}>\n`);

  const rows = parseSheet(filePath);
  const withPhone = rows.filter((r) => r.phone);
  const withoutPhone = rows.filter((r) => !r.phone);
  const internalDups = findInternalPhoneDuplicates(withPhone);

  console.log(`Total filas cliente       : ${rows.length}`);
  console.log(`Con teléfono              : ${withPhone.length}`);
  console.log(`Sin teléfono (se omiten)  : ${withoutPhone.length}`);

  if (internalDups.size > 0) {
    console.log(`\n⚠  Teléfonos duplicados DENTRO del archivo (${internalDups.size}):`);
    for (const [p, arr] of internalDups) {
      console.log(`    ${p}: ${arr.map((r) => `${r.name} (${r.doc || 'sin doc'})`).join('  |  ')}`);
    }
    console.log('    (solo se importará el primero de cada par; el resto va a revisión manual)');
  }

  // Reservar: a cada fila le asignamos un "skip reason" o null si va
  const decisions: Array<{ row: ExcelRow; reason: string | null; existing: string }> = [];
  const seenInternalPhone = new Set<string>();

  for (const r of withPhone) {
    const phone = normalizePhone(r.phone);
    if (internalDups.has(phone)) {
      if (seenInternalPhone.has(phone)) {
        decisions.push({ row: r, reason: 'teléfono duplicado dentro del archivo (2° del par)', existing: '' });
        continue;
      }
      seenInternalPhone.add(phone);
    }

    const existingClient = await ClientModel.findOne({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      phone,
      deletedAt: null,
    }).lean();
    if (existingClient) {
      decisions.push({
        row: r,
        reason: 'ya existe cliente con ese teléfono',
        existing: `${existingClient.fullName || existingClient.companyName || existingClient._id}`,
      });
      continue;
    }

    if (r.doc) {
      const docClean = r.doc.replace(/[\s-]/g, '');
      const existingTax = await ClientModel.findOne({
        tenantId: new mongoose.Types.ObjectId(tenantId),
        taxId: docClean,
        deletedAt: null,
      }).lean();
      if (existingTax) {
        decisions.push({
          row: r,
          reason: 'ya existe cliente con ese CUIT/doc',
          existing: `${existingTax.fullName || existingTax.companyName || existingTax._id}`,
        });
        continue;
      }
    }

    const existingLead = await LeadModel.findOne({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      phone,
      deletedAt: null,
    }).lean();
    if (existingLead) {
      decisions.push({
        row: r,
        reason: 'REVISIÓN MANUAL: teléfono existe como lead',
        existing: `${existingLead.name || existingLead.fullName || existingLead._id} (status=${existingLead.status})`,
      });
      continue;
    }

    decisions.push({ row: r, reason: null, existing: '' });
  }

  const toCreate = decisions.filter((d) => d.reason === null);
  const skipped = decisions.filter((d) => d.reason !== null);

  console.log(`\n=== DECISIONES ===`);
  console.log(`A importar           : ${toCreate.length}`);
  console.log(`Saltados             : ${skipped.length}`);
  skipped.forEach((d) => {
    console.log(`  - [SALTADO] ${d.row.name} | ${d.row.phone} | ${d.reason}${d.existing ? ` → existe: ${d.existing}` : ''}`);
  });
  if (withoutPhone.length > 0) {
    console.log(`  - [OMITIDO] ${withoutPhone.length} clientes sin teléfono (listado abajo)`);
  }

  if (args.dry) {
    console.log(`\n🔍 DRY RUN — no se modificó nada.`);
    console.log(`Próximos ${Math.min(15, toCreate.length)} a crear:`);
    toCreate.slice(0, 15).forEach((d) => {
      const addr = parseAddress(d.row.dom);
      console.log(
        `  - ${d.row.name}${d.row.razon !== d.row.name ? ` (razón: ${d.row.razon})` : ''} | ${d.row.phone} | ${d.row.iva} | ${d.row.doc || 'sin doc'} | ${addr.address}${addr.locality ? `, ${addr.locality}` : ''}${addr.province ? `, ${addr.province}` : ''}`
      );
    });
    if (withoutPhone.length > 0) {
      console.log(`\nSin teléfono (pendientes de completar):`);
      withoutPhone.slice(0, 30).forEach((r) => console.log(`  - ${r.name}${r.razon !== r.name ? ` (razón: ${r.razon})` : ''} | ${r.doc || 'sin doc'} | ${r.dom}`));
      if (withoutPhone.length > 30) console.log(`  ... y ${withoutPhone.length - 30} más`);
    }
    await mongoose.disconnect();
    return;
  }

  // -------------------------------------------------------------------------
  // RUN — crear cliente + gestión + contacto + conversación por cada fila
  // -------------------------------------------------------------------------
  console.log(`\n=== IMPORTANDO ${toCreate.length} clientes (batch ${args.batch}) ===`);

  const tenantObj = new mongoose.Types.ObjectId(tenantId);
  let created = 0;
  let failed = 0;
  const errors: Array<{ name: string; phone: string; error: string }> = [];

  async function importOne(d: { row: ExcelRow }) {
    const { row } = d;
    const phone = normalizePhone(row.phone);
    const fullName = row.name;
    const companyName = row.razon !== row.name ? row.razon : '';
    const addr = parseAddress(row.dom);
    const customerType = customerTypeFromIva(row.iva);
    const docClean = row.doc.replace(/[\s-]/g, '');
    const ivaCondition = (['CF', 'RI', 'MON', 'EX'] as const).includes(row.iva as never)
      ? (row.iva as 'CF' | 'RI' | 'MON' | 'EX')
      : null;

    // 1. Cliente (upsert — el índice único de Mongo es el candado final)
    const client = await ClientModel.findOneAndUpdate(
      { tenantId: tenantObj, phone },
      {
        $setOnInsert: {
          tenantId: tenantObj,
          fullName,
          companyName: companyName || undefined,
          taxId: docClean || undefined,
          ivaCondition,
          phone,
          address: addr.address || undefined,
          locality: addr.locality || undefined,
          province: addr.province || undefined,
          customerType,
          source: 'other',
          status: 'active',
          operationStatus: 'none',
          tags: [],
          createdBy: new mongoose.Types.ObjectId(userId),
          updatedBy: new mongoose.Types.ObjectId(userId),
        },
      },
      { upsert: true, new: true }
    ).lean();

    // 2. Gestión (solo si no hay una activa)
    const activeGestion = await GestionModel.findOne({
      tenantId: tenantObj,
      clientId: client._id,
      status: { $nin: ['won', 'lost'] },
    }).lean();
    if (!activeGestion) {
      await GestionModel.create({
        tenantId: tenantObj,
        clientId: client._id,
        name: companyName || fullName,
        phone,
        source: 'other',
        status: 'contacted',
        qualificationStatus: 'pending',
        customerType,
        address: addr.address || undefined,
        locality: addr.locality || undefined,
        province: addr.province || undefined,
        createdBy: userId,
        updatedBy: userId,
      });
    }

    // 3. Contacto (upsert por phone)
    const { firstName, lastName } = splitFullName(fullName);
    await ContactModel.findOneAndUpdate(
      { tenantId: tenantObj, phone },
      {
        $setOnInsert: {
          tenantId: tenantObj,
          clientId: client._id,
          phone,
          firstName,
          lastName,
          source: 'other',
          createdBy: userId,
          updatedBy: userId,
        },
      },
      { upsert: true, new: true }
    ).lean();

    // 4. Conversación vacía (solo si no existe por phoneNumber)
    const existingConv = await ConversationModel.findOne({
      tenantId: tenantObj,
      phoneNumber: phone,
    }).lean();
    if (!existingConv) {
      await ConversationModel.create({
        tenantId: tenantObj,
        phoneNumber: phone,
        lifecycleState: 'ACTIVE_CLIENT',
        state: 'idle',
        conversationType: 'customer',
        context: {
          hasEmergencyKeywords: false,
          hasProjectKeywords: false,
          messageContainsData: false,
          userAskedForHuman: false,
          ...(fullName && { customerName: fullName }),
          ...(companyName && { customerCompany: companyName }),
        },
        step: 0,
        lastActivityAt: new Date(),
        lastMessageAt: new Date(),
        startedAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        waitingMessageCount: 0,
        waitingPriority: 'normal',
        flowType: 'customer-service',
      });
    }

    return client;
  }

  // Batch sequential
  for (let i = 0; i < toCreate.length; i += args.batch) {
    const batch = toCreate.slice(i, i + args.batch);
    const results = await Promise.allSettled(batch.map(importOne));
    results.forEach((res, j) => {
      const row = batch[j].row;
      if (res.status === 'fulfilled') {
        created++;
        console.log(`  ✓ ${row.name} | ${row.phone} → ${res.value._id}`);
      } else {
        failed++;
        const errMsg = res.reason instanceof Error ? res.reason.message : String(res.reason);
        errors.push({ name: row.name, phone: row.phone, error: errMsg });
        console.log(`  ✗ ${row.name} | ${row.phone} → ${errMsg}`);
      }
    });
    console.log(`  -- batch ${i / args.batch + 1}/${Math.ceil(toCreate.length / args.batch)} (${created + failed}/${toCreate.length})`);
  }

  console.log(`\n=== RESUMEN FINAL ===`);
  console.log(`Creados : ${created}`);
  console.log(`Fallidos: ${failed}`);
  if (errors.length > 0) {
    console.log(`\nErrores:`);
    errors.forEach((e) => console.log(`  - ${e.name} | ${e.phone} | ${e.error}`));
  }
  console.log(`Saltados: ${skipped.length}`);
  console.log(`Sin teléfono (no cargados): ${withoutPhone.length}`);

  await mongoose.disconnect();
  console.log('\nListo.');
}

main().catch((err) => {
  console.error('failed:', err);
  process.exit(1);
});