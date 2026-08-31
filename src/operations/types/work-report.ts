import { Document, Types } from 'mongoose';
import { IAuditFields } from '../../crm/types/audit-fields';

// Enum types - exact values from specs
export type WorkResult =
  | 'Reparación completada'
  | 'Instalación completada'
  | 'Mantenimiento realizado'
  | 'Reparación parcial'
  | 'No fue posible completar el trabajo'
  | 'Requiere nueva visita';

export type WorkPerformed =
  | 'Limpieza'
  | 'Cambio de filtro'
  | 'Carga de refrigerante'
  | 'Reparación eléctrica'
  | 'Reparación mecánica'
  | 'Cambio de componente'
  | 'Instalación'
  | 'Diagnóstico'
  | 'Configuración'
  | 'Pruebas de funcionamiento';

export type AdditionalIssue =
  | 'Pérdida de refrigerante'
  | 'Instalación deficiente'
  | 'Problema eléctrico'
  | 'Problema mecánico'
  | 'Equipo muy deteriorado'
  | 'Otro';

export type NextVisitRecommendation =
  | 'No'
  | 'Sí urgente'
  | 'Sí dentro de 30 días'
  | 'Sí dentro de 3 meses'
  | 'Sí dentro de 6 meses'
  | 'Sí dentro de 1 año';

export interface IWorkReport extends Document, IAuditFields {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  workOrderId?: Types.ObjectId | null;
  technicalVisitId?: Types.ObjectId | null;
  technicianId: Types.ObjectId;
  result: WorkResult;
  workPerformed?: WorkPerformed[];
  workPerformedOther?: string | null;
  hasObservations?: boolean;
  observationsText?: string | null;
  hasAdditionalIssues?: boolean;
  additionalIssues?: AdditionalIssue[];
  additionalIssuesText?: string | null;
  nextVisitRecommendation?: NextVisitRecommendation | null;
  startedAt: Date;
  finishedAt: Date;
  arrivalTime?: Date | null;
  departureTime?: Date | null;
  internalComments?: string | null;
  materialsItems?: { item: string; quantity: number; unit: string }[];
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateWorkReportInput = Omit<
  IWorkReport,
  | keyof Document
  | '_id'
  | 'createdAt'
  | 'updatedAt'
  | 'createdBy'
  | 'updatedBy'
  | 'deletedBy'
  | 'deletedAt'
  | 'version'
>;

// Input type for API - tenantId is added by the service
// Uses more permissive types for API input (string instead of enum)
export interface CreateWorkReportApiInput {
  workOrderId?: string;
  technicalVisitId?: string;
  technicianId: string;
  result: string;
  workPerformed?: string[];
  workPerformedOther?: string;
  hasObservations?: boolean;
  observationsText?: string;
  hasAdditionalIssues?: boolean;
  additionalIssues?: string[];
  additionalIssuesText?: string;
  nextVisitRecommendation?: string;
  startedAt: Date;
  finishedAt: Date;
  arrivalTime?: Date | null;
  departureTime?: Date | null;
  internalComments?: string;
  materialsItems?: { item: string; quantity: number; unit: string }[];
}

export type UpdateWorkReportInput = Partial<
  Omit<CreateWorkReportInput, 'tenantId' | 'workOrderId' | 'technicalVisitId' | 'technicianId'>
>;

export interface WorkReportResponse {
  success: boolean;
  data?: IWorkReport;
  error?: string;
}