/**
 * Reconcile technician assignments.
 *
 * The canonical `WorkOrderAssignment` collection is the ONLY source of truth
 * for "who is assigned" on a WorkOrder; the denormalized `assignedTechnicians`
 * array (and `assignedTechnicianId` on TechnicalVisits) is written exclusively
 * by the assignment services. Some historical write paths only touched the
 * denormalized field, leaving work orders with a visible technician but no
 * active canonical record (the technician then saw the order in their list but
 * the start endpoint returned 404 "No active technician assignment found").
 *
 * This script REPAIRS that drift:
 *   - For every WorkOrder with a technician and no active canonical record it
 *     creates one (status 'assigned', reason 'data_reconciliation') and, when
 *     the work order status is 'scheduled'/'confirmed', promotes it to
 *     'assigned' (guarded).
 *   - A WorkOrder in status 'assigned' with no technician and no active
 *     canonical record is downgraded to 'confirmed' (guarded).
 *   - TechnicalVisits follow the same status alignment using the singular
 *     `assignedTechnicianId`.
 *
 * It is IDEMPOTENT and SAFE: every status write is guarded by the matching
 * status filter, advanced statuses are never overwritten, deleted records are
 * never touched, and technician existence is verified before creating records.
 *
 * Usage:
 *   npx tsx scripts/reconcile-assignments.ts --dry-run   # plan only
 *   npx tsx scripts/reconcile-assignments.ts             # execute
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import mongoose, { Types } from 'mongoose';
import { connectDB } from '../src/core/db';
import { WorkOrderModel } from '../src/operations/models';
import WorkOrderAssignmentModel from '../src/operations/models/work-order-assignment';
import { TechnicalVisitModel } from '../src/operations/models/technical-visit';
import {
  decideWorkOrderAction,
  decideVisitAction,
  AssignmentReconciliationAction,
} from '../src/operations/helpers/assignment-reconciliation';

const DRY_RUN = process.argv.includes('--dry-run');

interface Counters {
  assignmentsCreated: number;
  assignmentsUpdated: number;
  workOrdersPromoted: number;
  workOrdersDowngraded: number;
  visitsPromoted: number;
  visitsDowngraded: number;
  skipped: number;
  errors: number;
}

function makeCounters(): Counters {
  return {
    assignmentsCreated: 0,
    assignmentsUpdated: 0,
    workOrdersPromoted: 0,
    workOrdersDowngraded: 0,
    visitsPromoted: 0,
    visitsDowngraded: 0,
    skipped: 0,
    errors: 0,
  };
}

async function resolveSystemUserId(tenantId: Types.ObjectId): Promise<Types.ObjectId> {
  const users = mongoose.connection.db!.collection('users');
  const admin = await users.findOne({
    tenantId,
    deletedAt: null,
    status: 'active',
    email: /^admin/i,
  });
  if (admin) return admin._id;
  const anyUser = await users.findOne({ tenantId, deletedAt: null, status: 'active' });
  return anyUser ? anyUser._id : tenantId;
}

async function technicianExists(technicianId: string, tenantId: Types.ObjectId): Promise<boolean> {
  const techs = mongoose.connection.db!.collection('technicians');
  const t = await techs.findOne({ _id: new Types.ObjectId(technicianId), tenantId, deletedAt: null });
  return !!t;
}

async function ensureWorkOrderAssignment(
  workOrderId: Types.ObjectId,
  technicianId: string,
  tenantId: Types.ObjectId,
  systemUserId: Types.ObjectId,
): Promise<'created' | 'updated'> {
  const existing = await WorkOrderAssignmentModel.findOne({
    workOrderId,
    technicianId: new Types.ObjectId(technicianId),
    tenantId,
    deletedAt: null,
  }).lean();

  if (existing) {
    await WorkOrderAssignmentModel.findByIdAndUpdate(existing._id, {
      $set: {
        status: 'assigned',
        assignedAt: new Date(),
        assignedBy: systemUserId,
        assignmentType: 'manual',
        reason: 'data_reconciliation',
        reasonDetail: 'data_reconciliation',
        replacedAt: null,
        declinedAt: null,
      },
    });
    return 'updated';
  }

  await WorkOrderAssignmentModel.create({
    tenantId,
    workOrderId,
    technicianId: new Types.ObjectId(technicianId),
    assignmentType: 'manual',
    reason: 'data_reconciliation',
    reasonDetail: 'data_reconciliation',
    assignedBy: systemUserId,
    assignedAt: new Date(),
    status: 'assigned',
    notes: 'Created by data reconciliation script',
  });
  return 'created';
}

function log(prefix: string, message: string): void {
  const marker = DRY_RUN ? '[DRY-RUN]' : '[EXEC]';
  console.log(`${marker} ${prefix} ${message}`);
}

async function reconcileWorkOrders(counters: Counters): Promise<void> {
  console.log('\n=== WorkOrders ===');
  const workOrders = await WorkOrderModel.find({ deletedAt: null })
    .select('_id tenantId status assignedTechnicians workOrderNumber title')
    .lean();

  for (const wo of workOrders) {
    const label = `${wo.workOrderNumber} "${wo.title}" (${wo.status})`;
    const hasTechnicians = Array.isArray(wo.assignedTechnicians) && wo.assignedTechnicians.length > 0;
    const technicianId = hasTechnicians ? String(wo.assignedTechnicians![0]) : null;

    const activeAssignment = await WorkOrderAssignmentModel.findOne({
      workOrderId: wo._id,
      tenantId: wo.tenantId,
      status: { $in: ['assigned', 'acknowledged'] },
      deletedAt: null,
    }).lean();

    const decision = decideWorkOrderAction({
      status: wo.status,
      hasTechnicians,
      technicianId,
      hasActiveAssignment: !!activeAssignment,
    });

    await applyWorkOrderDecision(decision, wo, counters, label);
  }
}

async function applyWorkOrderDecision(
  decision: AssignmentReconciliationAction,
  wo: { _id: Types.ObjectId; tenantId: Types.ObjectId; status: string },
  counters: Counters,
  label: string,
): Promise<void> {
  switch (decision.action) {
    case 'create_assignment': {
      const systemUserId = await resolveSystemUserId(wo.tenantId);
      if (!(await technicianExists(decision.technicianId, wo.tenantId))) {
        counters.errors++;
        log('⚠', `WorkOrder ${label} — technician ${decision.technicianId} not found, skipped`);
        return;
      }
      log('→', `WorkOrder ${label} — create assignment for technician ${decision.technicianId}${decision.promote ? ' + promote to assigned' : ''}`);
      if (!DRY_RUN) {
        try {
          const how = await ensureWorkOrderAssignment(wo._id, decision.technicianId, wo.tenantId, systemUserId);
          if (how === 'created') counters.assignmentsCreated++;
          else counters.assignmentsUpdated++;
          if (decision.promote) {
            await WorkOrderModel.updateOne(
              { _id: wo._id, tenantId: wo.tenantId, status: { $in: ['scheduled', 'confirmed'] } },
              { $set: { status: 'assigned', updatedBy: systemUserId } },
            );
            counters.workOrdersPromoted++;
          }
        } catch (err) {
          counters.errors++;
          console.error('    ERROR:', (err as Error).message);
        }
      } else {
        if (decision.promote) counters.workOrdersPromoted++;
      }
      break;
    }

    case 'promote': {
      const systemUserId = await resolveSystemUserId(wo.tenantId);
      log('→', `WorkOrder ${label} — promote to assigned (active canonical exists)`);
      if (!DRY_RUN) {
        await WorkOrderModel.updateOne(
          { _id: wo._id, tenantId: wo.tenantId, status: { $in: ['scheduled', 'confirmed'] } },
          { $set: { status: 'assigned', updatedBy: systemUserId } },
        );
      }
      counters.workOrdersPromoted++;
      break;
    }

    case 'downgrade': {
      const systemUserId = await resolveSystemUserId(wo.tenantId);
      log('→', `WorkOrder ${label} — downgrade to confirmed (assigned without technician)`);
      if (!DRY_RUN) {
        await WorkOrderModel.updateOne(
          { _id: wo._id, tenantId: wo.tenantId, status: { $in: ['scheduled', 'assigned'] } },
          { $set: { status: 'confirmed', updatedBy: systemUserId } },
        );
      }
      counters.workOrdersDowngraded++;
      break;
    }

    case 'skip':
      counters.skipped++;
      log('·', `WorkOrder ${label} — skip (${decision.reason})`);
      break;
  }
}

async function reconcileTechnicalVisits(counters: Counters): Promise<void> {
  console.log('\n=== TechnicalVisits ===');
  const visits = await TechnicalVisitModel.find({ deletedAt: null })
    .select('_id tenantId status assignedTechnicianId visitNumber title')
    .lean();

  for (const visit of visits) {
    const label = `${visit.visitNumber} "${visit.title}" (${visit.status})`;
    const decision = decideVisitAction({
      status: visit.status,
      hasTechnician: !!visit.assignedTechnicianId,
    });

    switch (decision.action) {
      case 'promote': {
        const systemUserId = await resolveSystemUserId(visit.tenantId);
        log('→', `Visit ${label} — promote to assigned (technician set)`);
        if (!DRY_RUN) {
          await TechnicalVisitModel.updateOne(
            { _id: visit._id, tenantId: visit.tenantId, status: { $in: ['scheduled', 'confirmed'] } },
            { $set: { status: 'assigned', updatedBy: systemUserId } },
          );
        }
        counters.visitsPromoted++;
        break;
      }
      case 'downgrade': {
        const systemUserId = await resolveSystemUserId(visit.tenantId);
        log('→', `Visit ${label} — downgrade to confirmed (assigned without technician)`);
        if (!DRY_RUN) {
          await TechnicalVisitModel.updateOne(
            { _id: visit._id, tenantId: visit.tenantId, status: 'assigned' },
            { $set: { status: 'confirmed', updatedBy: systemUserId } },
          );
        }
        counters.visitsDowngraded++;
        break;
      }
      default:
        counters.skipped++;
        log('·', `Visit ${label} — skip (${(decision as { reason: string }).reason})`);
        break;
    }
  }
}

function printSummary(counters: Counters): void {
  console.log('\n========== SUMMARY ==========');
  const rows: Array<[string, number]> = [
    ['Assignments created', counters.assignmentsCreated],
    ['Assignments updated (reused existing record)', counters.assignmentsUpdated],
    ['WorkOrders promoted to assigned', counters.workOrdersPromoted],
    ['WorkOrders downgraded to confirmed', counters.workOrdersDowngraded],
    ['Visits promoted to assigned', counters.visitsPromoted],
    ['Visits downgraded to confirmed', counters.visitsDowngraded],
    ['Skipped', counters.skipped],
    ['Errors', counters.errors],
  ];
  const width = Math.max(...rows.map(([name]) => name.length)) + 2;
  for (const [name, count] of rows) {
    console.log(`  ${name.padEnd(width)} ${count}`);
  }
  console.log('==============================\n');
}

async function main(): Promise<void> {
  await connectDB();
  console.log(`Connected to database "${mongoose.connection.name}"`);
  console.log(`Mode: ${DRY_RUN ? 'DRY-RUN (no writes)' : 'EXECUTE (writes to database)'}`);

  const counters = makeCounters();

  await reconcileWorkOrders(counters);
  await reconcileTechnicalVisits(counters);

  printSummary(counters);

  // Verify the specific order mentioned in the bug report if it exists.
  const cucumber = await WorkOrderModel.findOne({
    deletedAt: null,
    title: /cucinelli/i,
  }).select('_id workOrderNumber status assignedTechnicians tenantId title').lean();

  if (cucumber) {
    console.log('=== Verification: Angel Cucinelli order ===');
    const active = await WorkOrderAssignmentModel.findOne({
      workOrderId: cucumber._id,
      tenantId: cucumber.tenantId,
      status: { $in: ['assigned', 'acknowledged'] },
      deletedAt: null,
    }).lean();
    console.log(`  ${cucumber.workOrderNumber} "${cucumber.title}" status=${cucumber.status}`);
    console.log(`  denormalized assignedTechnicians=${(cucumber.assignedTechnicians || []).map(String).join(',') || '(none)'}`);
    console.log(`  active canonical assignment: ${active ? `YES (status=${active.status}, technician=${active.technicianId})` : 'NO'}`);
    console.log('============================================');
  }

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
