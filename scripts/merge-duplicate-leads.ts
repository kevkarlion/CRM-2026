import { config } from 'dotenv';
config({ path: '.env.local' });

import mongoose from 'mongoose';
import type { Types } from 'mongoose';

const { connectDB } = await import('../src/core/db');

// Modelos
import { LeadModel, LeadAssignmentModel } from '../src/leads/models';
import { QuoteModel } from '../src/quotes/models';
import { WorkOrderModel, TechnicalVisitModel } from '../src/operations/models';
import { ActivityModel, WhatsAppMessageModel, FollowUpMarkModel } from '../src/crm/models';
import { NegotiationModel } from '../src/negotiation/models';
import ConversationModel from '../src/conversation/models/conversation';
import TimelineEventModel from '../src/timeline/models/timeline-event';
import RemitoModel from '../src/remitos/models/remito';

import type { ConversationState } from '../src/conversation/domain/conversation';

// Utilidades
import { normalizePhone } from '../src/lib/phone';

/**
 * Merge duplicate leads caused by a WhatsApp webhook race (TOCTOU).
 *
 * Two concurrent webhook messages for the same phone could both miss the
 * existing lead and create one Lead each, producing duplicate pipeline cards.
 * Before we add a partial unique index on { tenantId: 1, phone: 1 } (deletedAt null),
 * we must merge existing duplicates into a single surviving lead.
 *
 * For each duplicate group (same tenant + normalized phone):
 *   1. Pick the SURVIVOR: oldest createdAt (tie-break: smallest _id).
 *   2. MERGE the victim's lead fields onto the survivor so NO user data is lost
 *      when the victim is soft-deleted. Survivor wins when both have a value;
 *      notes/adminNotes are concatenated; score keeps the max; isB2B/isClient
 *      are OR'd; qualificationStatus keeps the most advanced; source/assignedTo
 *      and conversion references are only filled if the survivor is missing them.
 *   3. Re-point every `leadId` reference (quotes, messages, timeline, etc.)
 *      from each victim to the survivor.
 *   4. Conversations: if the SURVIVOR owns an ACTIVE conversation for the phone
 *      (verified by leadId, not just the number — avoids stealing a conversation
 *      that belongs to the victim), the victim's conversations are soft-closed
 *      (state 'closed', NOT deleted) so the bot keeps using the survivor's;
 *      otherwise the victim's conversations are re-pointed to the survivor and
 *      keep their own _id.
 *   5. Soft-delete each victim (deletedAt + deletedBy + previousLeadId) so the
 *      future partial unique index stays clean, keeping traceability.
 *
 * Idempotent: re-running finds no active duplicates (victims already soft-deleted)
 * and `updateMany` over already re-pointed references is a no-op.
 *
 * Run ad-hoc: npx tsx scripts/merge-duplicate-leads.ts
 * Preview only (writes nothing): npx tsx scripts/merge-duplicate-leads.ts --dry-run
 */

const MERGE_ORIGIN = 'merge-duplicate-leads-script';

interface LeadFullDoc {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  name: string;
  phone?: string | null;
  status: string;
  createdAt: Date;
  // Fields merged from victim onto survivor (see mergeLeadFields)
  companyName?: string | null;
  email?: string | null;
  profileName?: string | null;
  address?: string | null;
  locality?: string | null;
  province?: string | null;
  notes?: string | null;
  adminNotes?: string | null;
  inquiryReason?: string | null;
  customerType?: string | null;
  temperature?: string | null;
  priority?: string | null;
  estimatedValue?: number | null;
  source?: string | null;
  assignedTo?: Types.ObjectId | null;
  isB2B?: boolean;
  isClient?: boolean;
  score?: number | null;
  qualificationStatus?: string;
  lostReason?: string | null;
  lostDescription?: string | null;
  convertedToClient?: Types.ObjectId | null;
  convertedToWorkOrder?: Types.ObjectId | null;
  convertedAt?: Date | null;
}

interface LeadGroup {
  tenantId: Types.ObjectId;
  normalizedPhone: string;
  docs: LeadFullDoc[];
}

type ReferenceCollection = {
  label: string;
  model: {
    updateMany: (filter: object, update: object) => Promise<{ modifiedCount: number }>;
    countDocuments: (filter: object) => Promise<number>;
  };
};

const LEAD_REFERENCE_COLLECTIONS: ReferenceCollection[] = [
  { label: 'quotes', model: QuoteModel },
  { label: 'conversations', model: ConversationModel },
  { label: 'whatsapp-messages', model: WhatsAppMessageModel },
  { label: 'timeline-events', model: TimelineEventModel },
  { label: 'activities', model: ActivityModel },
  { label: 'follow-up-marks', model: FollowUpMarkModel },
  { label: 'work-orders', model: WorkOrderModel },
  { label: 'remitos', model: RemitoModel },
  { label: 'negotiations', model: NegotiationModel },
  { label: 'lead-assignments', model: LeadAssignmentModel },
  { label: 'technical-visits', model: TechnicalVisitModel },
];

function parseArgs(): boolean {
  return process.argv.includes('--dry-run');
}

// Orden de madurez para qualificationStatus (se conserva el más avanzado).
const QUALIFICATION_RANK: Record<string, number> = {
  not_qualified: 0,
  pending: 1,
  qualified: 2,
};

const NOTE_SEPARATOR = '\n\n---\n[víctima] ';

function isBlank(value: unknown): boolean {
  return value === null || value === undefined || value === '';
}

/**
 * Merge the victim's lead fields onto the survivor so no user data is lost
 * when the victim is soft-deleted.
 *
 * Rules (documented behavior):
 *  - Scalars (name, email, address, locality, etc.): survivor wins when both
 *    have a value; if the survivor is missing it, the victim's value is copied.
 *  - notes / adminNotes: concatenated when both exist, never lost.
 *  - score: keeps the maximum.
 *  - isB2B / isClient: true if either lead is true.
 *  - qualificationStatus: keeps the most advanced (qualified > pending > not_qualified).
 *  - source / assignedTo: only filled if the survivor is missing them.
 *  - convertedToClient / convertedToWorkOrder / convertedAt: kept if the survivor
 *    has them; otherwise copied from the victim when present.
 *  - status: SURVIVOR wins (decision logged separately in mergeGroup).
 *
 * Returns the $set to apply to the survivor (never contains undefined).
 */
function mergeLeadFields(
  survivor: LeadFullDoc,
  victim: LeadFullDoc,
  stats: Record<string, number>,
  dryRun: boolean
): Record<string, unknown> {
  const set: Record<string, unknown> = {};
  const changes: Array<{ field: string; from: unknown; to: unknown }> = [];

  const scalarFields = [
    'name', 'companyName', 'email', 'profileName', 'address', 'locality',
    'province', 'inquiryReason', 'customerType', 'temperature', 'priority',
    'estimatedValue', 'lostReason', 'lostDescription',
  ];

  for (const field of scalarFields) {
    const survivorValue = (survivor as Record<string, unknown>)[field];
    const victimValue = (victim as Record<string, unknown>)[field];
    if (isBlank(survivorValue) && !isBlank(victimValue)) {
      set[field] = victimValue;
      changes.push({ field, from: survivorValue, to: victimValue });
    }
  }

  for (const field of ['source', 'assignedTo']) {
    const survivorValue = (survivor as Record<string, unknown>)[field];
    const victimValue = (victim as Record<string, unknown>)[field];
    if (isBlank(survivorValue) && !isBlank(victimValue)) {
      set[field] = victimValue;
      changes.push({ field, from: survivorValue, to: victimValue });
    }
  }

  for (const field of ['notes', 'adminNotes']) {
    const survivorValue = (survivor as Record<string, unknown>)[field];
    const victimValue = (victim as Record<string, unknown>)[field];
    if (isBlank(survivorValue) && !isBlank(victimValue)) {
      set[field] = victimValue;
      changes.push({ field, from: survivorValue, to: victimValue });
    } else if (!isBlank(survivorValue) && !isBlank(victimValue)) {
      const merged = `${survivorValue as string}${NOTE_SEPARATOR}${victimValue as string}`;
      set[field] = merged;
      changes.push({ field, from: survivorValue, to: merged });
    }
  }

  const survivorScore = survivor.score ?? 0;
  const victimScore = victim.score ?? 0;
  if (victimScore > survivorScore) {
    set['score'] = victimScore;
    changes.push({ field: 'score', from: survivorScore, to: victimScore });
  }

  for (const field of ['isB2B', 'isClient']) {
    const survivorValue = !!survivor[field as 'isB2B' | 'isClient'];
    const victimValue = !!victim[field as 'isB2B' | 'isClient'];
    if (victimValue && !survivorValue) {
      set[field] = true;
      changes.push({ field, from: survivorValue, to: true });
    }
  }

  const survivorQualification = survivor.qualificationStatus ?? 'pending';
  const victimQualification = victim.qualificationStatus ?? 'pending';
  if (
    (QUALIFICATION_RANK[victimQualification] ?? 1) >
    (QUALIFICATION_RANK[survivorQualification] ?? 1)
  ) {
    set['qualificationStatus'] = victimQualification;
    changes.push({ field: 'qualificationStatus', from: survivorQualification, to: victimQualification });
  }

  for (const field of ['convertedToClient', 'convertedToWorkOrder', 'convertedAt']) {
    const survivorValue = (survivor as Record<string, unknown>)[field];
    const victimValue = (victim as Record<string, unknown>)[field];
    if (!isBlank(survivorValue)) continue;
    if (isBlank(victimValue)) continue;
    set[field] = victimValue;
    changes.push({ field, from: survivorValue, to: victimValue });
  }

  if (changes.length > 0) {
    stats['leads-fields-merged'] = (stats['leads-fields-merged'] ?? 0) + changes.length;
    console.log(`    Merge de campos sobre survivor (${survivor._id}):`);
    for (const change of changes) {
      console.log(
        `      ${dryRun ? '[dry-run] ' : ''}${change.field}: '${change.from}' → '${change.to}'`
      );
    }
  } else {
    console.log(`    Merge de campos: sin cambios (el survivor ya tenía todos los valores).`);
  }

  return set;
}

/**
 * Re-point every `leadId` reference from the victim lead to the survivor lead.
 * Naturally idempotent: `updateMany` over already-re-pointed rows reports 0.
 */
async function repointLeadReferences(
  victimId: Types.ObjectId,
  survivorId: Types.ObjectId,
  collections: ReferenceCollection[],
  stats: Record<string, number>,
  dryRun: boolean
): Promise<void> {
  for (const ref of collections) {
    const filter = { leadId: victimId };
    const update = { $set: { leadId: survivorId } };

    if (dryRun) {
      const count = await ref.model.countDocuments(filter);
      if (count > 0) {
        stats[ref.label] = (stats[ref.label] ?? 0) + count;
        console.log(`    [dry-run] Repuntaría ${count} referencia(s) en ${ref.label}`);
      }
    } else {
      const res = await ref.model.updateMany(filter, update);
      if (res.modifiedCount > 0) {
        stats[ref.label] = (stats[ref.label] ?? 0) + res.modifiedCount;
        console.log(`    ${ref.label}: ${res.modifiedCount} referencia(s) repuntada(s)`);
      }
    }
  }
}

/**
 * Check whether the SURVIVOR owns an ACTIVE conversation for the phone.
 * Mirrors the bot lookup in webhook-integration: normalized phone OR last 10 digits.
 * BUGFIX: the query MUST verify `leadId: survivorId` — matching by phone number
 * alone can return the VICTIM's conversation, which would make the script close
 * the wrong conversation and leave the phone with NO active conversation.
 */
async function findActiveConversationForPhone(
  tenantId: Types.ObjectId,
  survivorId: Types.ObjectId,
  normalizedPhone: string
): Promise<{ _id: Types.ObjectId } | null> {
  const last10Digits = normalizedPhone.replace(/^\d{2,3}/, '');
  return ConversationModel.findOne({
    tenantId,
    leadId: survivorId,
    $or: [
      { phoneNumber: normalizedPhone },
      { phoneNumber: { $regex: `${last10Digits}$` } },
    ],
    state: { $nin: ['closed', 'timeout'] },
  }).sort({ lastMessageAt: -1 }).lean();
}

/**
 * Soft-close the victim's conversations when the survivor keeps their own.
 * Uses the same fields the app uses to close a conversation (state 'closed' + closedAt).
 * NOTE: conversations are soft-closed, never deleted — no data is destroyed.
 * Logs every conversation _id so the merge is auditable in dry-run.
 */
async function closeVictimConversations(
  victimId: Types.ObjectId,
  stats: Record<string, number>,
  dryRun: boolean
): Promise<void> {
  const victimConversations = await ConversationModel.find({ leadId: victimId }).lean();

  let toClose = 0;
  for (const conv of victimConversations) {
    if (conv.state === 'closed' || conv.state === 'timeout') continue;
    toClose += 1;
    console.log(
      `    [conversación ${conv._id}] soft-close → state: 'closed', lifecycleState: 'CLOSED', closedAt: ahora` +
        (dryRun ? ' (dry-run, no escrito)' : '')
    );

    if (!dryRun) {
      await ConversationModel.updateOne(
        { _id: conv._id },
        {
          $set: {
            state: 'closed' as ConversationState,
            lifecycleState: 'CLOSED' as const,
            closedAt: new Date(),
          },
        }
      );
    }
  }

  if (toClose > 0) {
    stats['conversations-closed'] = (stats['conversations-closed'] ?? 0) + toClose;
    console.log(`    ${toClose} conversación(es) del lead víctima cerradas`);
  }
}

/**
 * Soft-delete a victim lead, keeping traceability via previousLeadId so the
 * future partial unique index ({ tenantId, phone }, deletedAt null) stays clean.
 */
async function softDeleteVictim(
  victim: LeadFullDoc,
  survivor: LeadFullDoc,
  dryRun: boolean
): Promise<void> {
  if (dryRun) {
    console.log(`    [dry-run] Lead ${victim._id} → deletedAt + previousLeadId=${survivor._id}`);
    return;
  }

  await LeadModel.updateOne(
    { _id: victim._id },
    { $set: { deletedAt: new Date(), deletedBy: MERGE_ORIGIN, previousLeadId: survivor._id } }
  );
}

function pickSurvivor(docs: LeadFullDoc[]): { survivor: LeadFullDoc; victims: LeadFullDoc[] } {
  const sorted = [...docs].sort(
    (a, b) =>
      a.createdAt.getTime() - b.createdAt.getTime() ||
      a._id.toString().localeCompare(b._id.toString())
  );
  return { survivor: sorted[0], victims: sorted.slice(1) };
}

async function mergeGroup(
  group: LeadGroup,
  stats: Record<string, number>,
  dryRun: boolean
): Promise<void> {
  const { survivor, victims } = pickSurvivor(group.docs);

  console.log(`\nGrupo ${group.normalizedPhone} (tenant ${group.tenantId}) — ${group.docs.length} leads`);
  console.log(`  Survivor: ${survivor._id} (${survivor.name}, ${survivor.status})`);

  const survivorConversation = await findActiveConversationForPhone(
    group.tenantId,
    survivor._id,
    group.normalizedPhone
  );
  const survivorHasActiveConversation = Boolean(survivorConversation);
  console.log(
    survivorHasActiveConversation
      ? `  Survivor tiene conversación ACTIVA (${survivorConversation!._id}); las del víctima se cerrarán`
      : `  Survivor sin conversación activa; las del víctima pasarán al survivor`
  );

  // Si el survivor ya tiene conversación activa, NO re-punteamos conversaciones:
  // las del víctima se cierran para no romper el flujo del bot.
  const collectionsToRepoint = LEAD_REFERENCE_COLLECTIONS.filter(
    (ref) => !(survivorHasActiveConversation && ref.label === 'conversations')
  );

  for (const victim of victims) {
    console.log(`\n  Víctima: ${victim._id} (${victim.name}, ${victim.status})`);
    console.log(`    Estado final: ${survivor.status} (sobreviviente) — víctima era ${victim.status}`);

    // Merge de campos: el survivor absorbe los datos del víctima (sin borrar nada).
    const mergedFields = mergeLeadFields(survivor, victim, stats, dryRun);
    if (!dryRun && Object.keys(mergedFields).length > 0) {
      await LeadModel.updateOne({ _id: survivor._id }, { $set: mergedFields });
    }

    await repointLeadReferences(victim._id, survivor._id, collectionsToRepoint, stats, dryRun);

    if (survivorHasActiveConversation) {
      await closeVictimConversations(victim._id, stats, dryRun);
    }

    await softDeleteVictim(victim, survivor, dryRun);
  }
}

async function mergeDuplicateLeads(): Promise<void> {
  const dryRun = parseArgs();

  console.log('Conectando…');
  await connectDB();
  console.log('Conectado.\n');

  console.log(
    dryRun
      ? 'MODO DRY-RUN: no se escribirá nada en la base.'
      : 'Modo normal: se escribirán los cambios.\n'
  );

  const leads = await LeadModel.find({
    deletedAt: null,
    phone: { $exists: true, $nin: [null, ''] },
  })
    .select(
      '_id tenantId name phone status createdAt companyName email profileName address locality province notes adminNotes inquiryReason customerType temperature priority estimatedValue source assignedTo isB2B isClient score qualificationStatus lostReason lostDescription convertedToClient convertedToWorkOrder convertedAt'
    )
    .lean<LeadFullDoc[]>();

  console.log(`Leads activos con teléfono: ${leads.length}\n`);

  // Agrupamos en memoria usando la MISMA normalización que la app (normalizePhone).
  // La agregación de Mongo no puede invocar la TS normalizePhone; el dataset es chico.
  const groups = new Map<string, LeadGroup>();
  for (const lead of leads) {
    if (!lead.phone) continue;
    const normalizedPhone = normalizePhone(lead.phone);
    const key = `${lead.tenantId.toString()}::${normalizedPhone}`;
    const existing = groups.get(key);
    if (existing) {
      existing.docs.push(lead);
    } else {
      groups.set(key, { tenantId: lead.tenantId, normalizedPhone, docs: [lead] });
    }
  }

  const duplicateGroups = [...groups.values()].filter((g) => g.docs.length > 1);
  console.log(`Grupos duplicados encontrados: ${duplicateGroups.length}\n`);

  const stats: Record<string, number> = {};
  let victimsTotal = 0;

  for (const group of duplicateGroups) {
    await mergeGroup(group, stats, dryRun);
    victimsTotal += group.docs.length - 1;
  }

  console.log('\n================ RESUMEN ================');
  console.log(`Grupos duplicados encontrados: ${duplicateGroups.length}`);
  console.log(`Grupos mergeados: ${duplicateGroups.length}`);
  console.log(`Leads víctimas (soft-deleted): ${victimsTotal}`);

  let anyReferences = false;
  for (const ref of LEAD_REFERENCE_COLLECTIONS) {
    const n = stats[ref.label] ?? 0;
    if (n > 0) {
      anyReferences = true;
      console.log(`  ${ref.label}: ${n} referencia(s) repuntada(s)`);
    }
  }
  const closed = stats['conversations-closed'] ?? 0;
  if (closed > 0) {
    anyReferences = true;
    console.log(`  conversaciones cerradas (soft-close): ${closed}`);
  }
  const fieldsMerged = stats['leads-fields-merged'] ?? 0;
  if (fieldsMerged > 0) {
    anyReferences = true;
    console.log(`  campos de lead mergeados (survivor ← víctima): ${fieldsMerged}`);
  }
  if (!anyReferences) {
    console.log('  (ninguna referencia repuntada)');
  }

  if (dryRun) {
    console.log('\nDRY-RUN: no se realizaron cambios en la base.');
  }

  await mongoose.disconnect();
}

mergeDuplicateLeads().catch((err) => {
  console.error('failed:', err);
  process.exit(1);
});