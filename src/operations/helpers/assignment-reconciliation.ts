/**
 * Pure decision logic for the assignment reconciliation script.
 *
 * The canonical `WorkOrderAssignment` (and, for TechnicalVisits, the
 * assignment service) is the ONLY source of truth for "who is assigned".
 * These helpers decide what the reconciliation must do for a single entity
 * WITHOUT touching the database, which keeps them unit-testable.
 *
 * Invariants enforced (mirrors the working tree's business rules):
 * - Assigning a tech promotes status to 'assigned' ONLY from 'scheduled'/'confirmed'.
 * - Unassigning the last tech downgrades to 'confirmed' ONLY from 'scheduled'/'assigned'.
 * - Advanced statuses (en_route, on_site, in_progress, completed, ...) are never touched.
 */

export type AssignmentReconciliationAction =
  | { action: 'create_assignment'; technicianId: string; promote: boolean }
  | { action: 'promote'; technicianId?: string }
  | { action: 'downgrade' }
  | { action: 'skip'; reason: string };

export interface WorkOrderReconciliationInput {
  status: string;
  hasTechnicians: boolean;
  technicianId?: string | null;
  hasActiveAssignment: boolean;
}

export interface VisitReconciliationInput {
  status: string;
  hasTechnician: boolean;
}

const PROMOTABLE_STATUSES = ['scheduled', 'confirmed'];

export function decideWorkOrderAction(input: WorkOrderReconciliationInput): AssignmentReconciliationAction {
  const { status, hasTechnicians, technicianId, hasActiveAssignment } = input;

  if (hasTechnicians) {
    if (!technicianId) {
      return { action: 'skip', reason: 'assignedTechnicians present but no technician id' };
    }
    if (!hasActiveAssignment) {
      return {
        action: 'create_assignment',
        technicianId,
        promote: PROMOTABLE_STATUSES.includes(status),
      };
    }
    if (PROMOTABLE_STATUSES.includes(status)) {
      return { action: 'promote', technicianId };
    }
    return { action: 'skip', reason: 'already has an active assignment' };
  }

  if (status === 'assigned') {
    if (hasActiveAssignment) {
      return { action: 'skip', reason: 'status assigned matches an active canonical assignment' };
    }
    return { action: 'downgrade' };
  }

  return { action: 'skip', reason: 'no technician assigned' };
}

export function decideVisitAction(input: VisitReconciliationInput): AssignmentReconciliationAction {
  const { status, hasTechnician } = input;

  if (hasTechnician) {
    if (PROMOTABLE_STATUSES.includes(status)) {
      return { action: 'promote' };
    }
    return { action: 'skip', reason: 'visit status is consistent or advanced' };
  }

  if (status === 'assigned') {
    return { action: 'downgrade' };
  }

  return { action: 'skip', reason: 'no technician assigned' };
}
