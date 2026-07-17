import { Document, Types } from 'mongoose';

export type AssignmentStatus = 'assigned' | 'acknowledged' | 'declined' | 'replaced';

export type AssignmentType = 
  | 'initial'           // Primera asignación al crear la OT
  | 'auto_assignment'   // El técnico se auto-asigna
  | 'manual'            // Asignación manual por administrador
  | 'redistribution'    // Redistribución de carga
  | 'replacement';      // Reemplazo de técnico

export type AssignmentReason =
  | 'customer_request'    // Solicitud del cliente
  | 'proximity'           // El técnico está cerca del cliente
  | 'availability'        // El técnico tiene tiempo disponible
  | 'coverage'            // Cobertura de zona
  | 'specialty'           // Por especialidad técnica requerida
  | 'priority'            // Prioridad alta
  | 'replacement'         // Reemplazo de compañero
  | 'schedule_change'     // Cambio en agenda
  | 'performance'         // Por rendimiento/métricas
  | 'other';              // Otro motivo

export interface IWorkOrderAssignment extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  workOrderId: Types.ObjectId;
  technicianId: Types.ObjectId;
  
  // Auditoría completa
  previousTechnicianId?: Types.ObjectId;  // Técnico anterior (para reemplazos)
  assignmentType: AssignmentType;         // Tipo de asignación
  reason: AssignmentReason;               // Motivo de asignación
  reasonDetail?: string;                  // Detalle adicional del motivo
  
  assignedBy: Types.ObjectId;
  assignedAt: Date;
  status: AssignmentStatus;
  
  acknowledgedAt?: Date;
  declinedAt?: Date;
  replacedAt?: Date;
  replacedByAssignmentId?: Types.ObjectId;
  
  notes?: string;                         // Observaciones
  createdAt: Date;
  updatedAt: Date;
}

export type CreateWorkOrderAssignmentInput = Omit<
  IWorkOrderAssignment,
  keyof Document | '_id' | 'createdAt' | 'updatedAt' | 'status' | 'acknowledgedAt' | 'declinedAt' | 'replacedAt' | 'replacedByAssignmentId'
>;
