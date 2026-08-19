import { Schema } from 'mongoose';
import { IWorkReport } from '../types/work-report';

// Enum values for form fields - exact values from specs
export const WORK_RESULT = [
  'Reparación completada',
  'Instalación completada',
  'Mantenimiento realizado',
  'Reparación parcial',
  'No fue posible completar el trabajo',
  'Requiere nueva visita',
] as const;

export const WORK_PERFORMED = [
  'Limpieza',
  'Cambio de filtro',
  'Carga de refrigerante',
  'Reparación eléctrica',
  'Reparación mecánica',
  'Cambio de componente',
  'Instalación',
  'Diagnóstico',
  'Configuración',
  'Pruebas de funcionamiento',
] as const;

export const ADDITIONAL_ISSUES = [
  'Pérdida de refrigerante',
  'Instalación deficiente',
  'Problema eléctrico',
  'Problema mecánico',
  'Equipo muy deteriorado',
  'Otro',
] as const;

export const NEXT_VISIT_RECOMMENDATION = [
  'No',
  'Sí urgente',
  'Sí dentro de 30 días',
  'Sí dentro de 3 meses',
  'Sí dentro de 6 meses',
  'Sí dentro de 1 año',
] as const;

const auditFields = {
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  deletedAt: { type: Date, default: null },
};

export const workReportSchema = new Schema<IWorkReport>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    workOrderId: { type: Schema.Types.ObjectId, ref: 'WorkOrder', default: null },
    technicalVisitId: { type: Schema.Types.ObjectId, ref: 'TechnicalVisit', default: null },
    technicianId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    result: {
      type: String,
      required: true,
      enum: WORK_RESULT,
    },
    workPerformed: {
      type: [String],
      enum: WORK_PERFORMED,
      default: [],
    },
    workPerformedOther: {
      type: String,
      default: null,
    },
    hasObservations: {
      type: Boolean,
      default: false,
    },
    observationsText: {
      type: String,
      default: null,
      maxlength: 5000,
    },
    hasAdditionalIssues: {
      type: Boolean,
      default: false,
    },
    additionalIssues: {
      type: [String],
      enum: ADDITIONAL_ISSUES,
      default: [],
    },
    additionalIssuesText: {
      type: String,
      default: null,
      maxlength: 5000,
    },
    nextVisitRecommendation: {
      type: String,
      enum: NEXT_VISIT_RECOMMENDATION,
      default: null,
    },
    startedAt: {
      type: Date,
      required: true,
    },
    finishedAt: {
      type: Date,
      required: true,
    },
    version: { type: Number, default: 0 },
    ...auditFields,
  },
  { timestamps: true }
);

// Indexes - use sparse to handle null values correctly
workReportSchema.index({ tenantId: 1, workOrderId: 1 }, { sparse: true });
workReportSchema.index({ tenantId: 1, technicalVisitId: 1 }, { sparse: true });
workReportSchema.index({ tenantId: 1, technicianId: 1, createdAt: -1 });