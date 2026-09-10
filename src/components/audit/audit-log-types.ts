export type AuditLogAction =
  | 'created' | 'updated' | 'deleted' | 'read'
  | 'assigned' | 'unassigned'
  | 'status_changed' | 'rejected' | 'converted' | 'version_created'
  | 'activated' | 'paused' | 'cancelled' | 'expired'
  | 'equipment_added' | 'equipment_removed' | 'work_order_generated'
  | 'status.change' | 'rescheduled'
  | 'workStatus_changed'
  | 'technician.assigned' | 'technician.reassigned' | 'technician.unassigned'
  | 'checklist.created' | 'checklist.completed' | 'report.created'
  | 'work_started' | 'work_completed' | 'work_report_created';

export interface AuditLogEntry {
  _id: string;
  tenantId: string;
  entityType: string;
  entityId: string;
  action: AuditLogAction;
  actorId: string;
  actorName?: string;
  actorEmail?: string;
  changes?: {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
  };
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export interface AuditLogResponse {
  data: AuditLogEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface AuditLogFilters {
  search?: string;
  action?: string;
  entityType?: string;
  actorId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export const ACTION_LABELS: Record<string, string> = {
  created: 'Creado',
  read: 'Consultado',
  updated: 'Actualizado',
  deleted: 'Eliminado',
  assigned: 'Asignado',
  unassigned: 'Desasignado',
  status_changed: 'Estado cambiado',
  workStatus_changed: 'Estado de trabajo cambiado',
  rejected: 'Rechazado',
  converted: 'Convertido',
  version_created: 'Versión creada',
  activated: 'Activado',
  paused: 'Pausado',
  cancelled: 'Cancelado',
  expired: 'Expirado',
  equipment_added: 'Equipo agregado',
  equipment_removed: 'Equipo removido',
  work_order_generated: 'Orden de trabajo generada',
  'status.change': 'Cambio de estado',
  rescheduled: 'Reprogramado',
  'technician.assigned': 'Técnico asignado',
  'technician.reassigned': 'Técnico reasignado',
  'technician.unassigned': 'Técnico desasignado',
  'checklist.created': 'Checklist creado',
  'checklist.completed': 'Checklist completado',
  'report.created': 'Reporte creado',
  work_started: 'Trabajo iniciado',
  work_completed: 'Trabajo completado',
  work_report_created: 'Reporte de trabajo creado',
};

export const ACTION_BADGE_VARIANT: Record<string, string> = {
  created: 'bg-success-50 text-success-700',
  converted: 'bg-success-50 text-success-700',
  activated: 'bg-success-50 text-success-700',
  work_completed: 'bg-success-50 text-success-700',
  'checklist.completed': 'bg-success-50 text-success-700',
  read: 'bg-success-50 text-success-700',
  updated: 'bg-info-50 text-info-700',
  'status_changed': 'bg-info-50 text-info-700',
  workStatus_changed: 'bg-info-50 text-info-700',
  'status.change': 'bg-info-50 text-info-700',
  version_created: 'bg-info-50 text-info-700',
  work_started: 'bg-info-50 text-info-700',
  'report.created': 'bg-info-50 text-info-700',
  'checklist.created': 'bg-info-50 text-info-700',
  work_report_created: 'bg-info-50 text-info-700',
  deleted: 'bg-danger-50 text-danger-700',
  rejected: 'bg-danger-50 text-danger-700',
  cancelled: 'bg-danger-50 text-danger-700',
  expired: 'bg-danger-50 text-danger-700',
  assigned: 'bg-warning-50 text-warning-700',
  unassigned: 'bg-warning-50 text-warning-700',
  rescheduled: 'bg-warning-50 text-warning-700',
  paused: 'bg-warning-50 text-warning-700',
  'technician.assigned': 'bg-warning-50 text-warning-700',
  'technician.reassigned': 'bg-warning-50 text-warning-700',
  'technician.unassigned': 'bg-warning-50 text-warning-700',
  equipment_added: 'bg-warning-50 text-warning-700',
  equipment_removed: 'bg-warning-50 text-warning-700',
  work_order_generated: 'bg-warning-50 text-warning-700',
};

export const ENTITY_TYPE_LABELS: Record<string, string> = {
  lead: 'Lead',
  client: 'Cliente',
  workOrder: 'Orden de trabajo',
  quote: 'Presupuesto',
  technicalVisit: 'Visita técnica',
  user: 'Usuario',
  tenant: 'Tenant',
  contract: 'Contrato',
  auth: 'Autenticación',
  document: 'Documento',
  gestion: 'Gestión',
  pipeline: 'Pipeline',
  remito: 'Remito',
};
