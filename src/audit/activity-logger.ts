import { Types } from 'mongoose';
import ActivityLogModel from '../core/models/activity-log';
import { ActivityAction } from '../core/types/activity-log';
import TimelineEventModel from '../timeline/models/timeline-event';

export interface ActivityLogInput {
  tenantId: string | Types.ObjectId;
  entityType: string;
  entityId: string | Types.ObjectId;
  action: ActivityAction;
  actorId: string | Types.ObjectId;
  leadId?: string | Types.ObjectId;
  clientId?: string | Types.ObjectId;
  changes?: {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
  };
  metadata?: Record<string, unknown>;
}

/**
 * Logs a business entity mutation to the ActivityLog.
 *
 * ActivityLog is APPEND-ONLY — entries are never modified or deleted.
 *
 * Use for: entity creation, updates, deletion, assignment, status changes.
 *
 * @example
 *   await logActivity({
 *     tenantId: '...',
 *     entityType: 'lead',
 *     entityId: lead._id,
 *     action: 'created',
 *     actorId: user._id,
 *   });
 */
export async function logActivity(input: ActivityLogInput): Promise<void> {
  const tenantId = typeof input.tenantId === 'string' 
    ? input.tenantId 
    : input.tenantId.toString();
  
  const actorId = typeof input.actorId === 'string' 
    ? input.actorId 
    : input.actorId.toString();

  const entityId = typeof input.entityId === 'string' 
    ? input.entityId 
    : input.entityId.toString();

  try {
    // Log to ActivityLog (basic logging)
    await ActivityLogModel.create({
      tenantId: input.tenantId,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      actorId: input.actorId,
      changes: input.changes || undefined,
      metadata: input.metadata || undefined,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('[ActivityLogger] Failed to persist activity:', error);
  }

  // Also create TimelineEvent for visual timeline (if metadata provided)
  if (input.metadata) {
    try {
      const title = getEventTitle(input.entityType, input.action, input.metadata);
      const { color, icon } = getEventStyle(input.entityType, input.action);
      
      const timelineDoc: Record<string, unknown> = {
        tenantId: new Types.ObjectId(tenantId),
        entityType: input.entityType,
        entityId: new Types.ObjectId(entityId),
        eventType: `${input.entityType}.${input.action}`,
        title,
        icon,
        color,
        performedBy: new Types.ObjectId(actorId),
        metadata: input.metadata,
      };

      // Add leadId or clientId if provided
      if (input.leadId) {
        timelineDoc.leadId = typeof input.leadId === 'string' 
          ? new Types.ObjectId(input.leadId) 
          : input.leadId;
      }
      if (input.clientId) {
        timelineDoc.clientId = typeof input.clientId === 'string' 
          ? new Types.ObjectId(input.clientId) 
          : input.clientId;
      }

      await TimelineEventModel.create(timelineDoc);
    } catch (timelineError) {
      console.error('[ActivityLogger] Failed to create timeline event:', timelineError);
    }
  }
}

function getEventTitle(entityType: string, action: string, metadata: Record<string, unknown>): string {
  // Generate descriptive title based on entity type and action
  
  if (entityType === 'quote') {
    const number = metadata.number as string || '';
    const status = metadata.status as string || action;
    return `Presupuesto ${number} - ${getStatusLabel(status)}`;
  }
  
  if (entityType === 'workOrder') {
    const number = metadata.workOrderNumber as string || '';
    const title = metadata.title as string || '';
    return `OT ${number} ${title} - ${getActionLabel(action)}`;
  }

  if (entityType === 'technicalVisit') {
    const number = metadata.visitNumber as string || '';
    const title = metadata.title as string || '';
    return `VT ${number} ${title} - ${getActionLabel(action)}`;
  }

  if (entityType === 'contract') {
    const name = metadata.contractName as string || '';
    return `Contrato ${name} - ${getActionLabel(action)}`;
  }

  if (entityType === 'lead') {
    return `Lead - ${getActionLabel(action)}`;
  }

  if (entityType === 'client') {
    return `Cliente - ${getActionLabel(action)}`;
  }

  return `${entityType} - ${getActionLabel(action)}`;
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: 'Borrador',
    sent: 'Enviado',
    approved: 'Aprobado',
    rejected: 'Rechazado',
    expired: 'Expirado',
    cancelled: 'Cancelado',
    created: 'Creado',
  };
  return labels[status] || status;
}

function getActionLabel(action: string): string {
  const labels: Record<string, string> = {
    created: 'creado',
    updated: 'actualizado',
    deleted: 'eliminado',
    sent: 'enviado',
    approved: 'aprobado',
    rejected: 'rechazado',
    work_started: 'iniciado',
    work_completed: 'completado',
    visit_started: 'iniciado',
    visit_completed: 'completado',
    activated: 'activado',
    paused: 'pausado',
    expired: 'expirado',
    equipment_added: 'equipo agregado',
    equipment_removed: 'equipo eliminado',
  };
  return labels[action] || action;
}

function getEventStyle(entityType: string, action: string): { color: string; icon: string } {
  // Default styles based on entity type
  const styles: Record<string, { color: string; icon: string }> = {
    quote: { color: 'bg-purple-500', icon: '📄' },
    workOrder: { color: 'bg-blue-500', icon: '🔧' },
    technicalVisit: { color: 'bg-orange-500', icon: '📅' },
    contract: { color: 'bg-green-500', icon: '📜' },
    lead: { color: 'bg-yellow-500', icon: '🎯' },
    client: { color: 'bg-indigo-500', icon: '👤' },
  };

  // Override color based on action
  const baseStyle = styles[entityType] || { color: 'bg-gray-500', icon: '📌' };
  
  if (action === 'approved' || action === 'work_completed' || action === 'visit_completed') {
    return { ...baseStyle, color: 'bg-green-500' };
  }
  if (action === 'rejected' || action === 'cancelled' || action === 'deleted') {
    return { ...baseStyle, color: 'bg-red-500' };
  }
  if (action === 'sent') {
    return { ...baseStyle, color: 'bg-indigo-500' };
  }

  return baseStyle;
}

/**
 * Retrieves the activity history for a specific entity.
 */
export async function getEntityHistory(
  tenantId: string | Types.ObjectId,
  entityType: string,
  entityId: string | Types.ObjectId,
  options?: { limit?: number }
) {
  return ActivityLogModel.find({
    tenantId,
    entityType,
    entityId,
  })
    .sort({ timestamp: -1 })
    .limit(options?.limit || 50)
    
    .exec();
}

/**
 * Retrieves recent activity for a tenant (activity feed).
 */
export async function getTenantActivityFeed(
  tenantId: string | Types.ObjectId,
  options?: { limit?: number; entityType?: string }
) {
  const filter: Record<string, unknown> = { tenantId };

  if (options?.entityType) {
    filter.entityType = options.entityType;
  }

  return ActivityLogModel.find(filter)
    .sort({ timestamp: -1 })
    .limit(options?.limit || 20)
    
    .exec();
}