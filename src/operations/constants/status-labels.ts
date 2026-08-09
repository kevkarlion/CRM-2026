import type { WorkOrderStatus } from '@/operations/types/work-order';

export const WORK_ORDER_STATUS_LABELS: Record<string, string> = {
  pending_assignment: 'Pendiente',
  assigned: 'Asignada',
  scheduled: 'Programada',
  in_progress: 'En Ejecución',
  closed: 'Cerrada',
  cancelled: 'Cancelada',
  // Estados viejos (compatibilidad)
  draft: 'Borrador',
  confirmed: 'Confirmada',
  paused: 'Pausada',
  completed: 'Cerrada',
};

type TechnicalVisitStatus =
  | 'draft'
  | 'scheduled'
  | 'confirmed'
  | 'assigned'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'converted_to_work_order';

export const TECHNICAL_VISIT_STATUS_LABELS: Record<TechnicalVisitStatus, string> = {
  draft: 'Borrador',
  scheduled: 'Programada',
  confirmed: 'Confirmada',
  assigned: 'Asignada',
  in_progress: 'En Progreso',
  completed: 'Completada',
  cancelled: 'Cancelada',
  converted_to_work_order: 'Convertida a OT',
};
