import { Schema } from 'mongoose';
import { IWorkOrder } from '../types/work-order';

const auditFields = {
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  deletedAt: { type: Date, default: null },
};

const clientSnapshotSchema = new Schema({
  name: String,
  email: String,
  phone: String,
  taxId: String,
  customerType: String,
  status: String,
}, { _id: false });

const locationDetailsSchema = new Schema({
  floor: String,
  apartment: String,
  tower: String,
  office: String,
  neighborhood: String,
  block: String,
  lot: String,
  reference: String,
  observations: String,
}, { _id: false });

const locationSnapshotSchema = new Schema({
  name: String,
  address: String,
  city: String,
  province: String,
  country: String,
  postalCode: String,
  // Google Maps coordinates
  latitude: Number,
  longitude: Number,
  placeId: String,
  // Additional location details
  details: { type: locationDetailsSchema, default: null },
}, { _id: false });

// Schema para campos adicionales del técnico
const technicianNotesSchema = new Schema({
  materials: { type: String, default: null },       // Materiales que necesita
  tools: { type: String, default: null },           // Herramientas requeridas
  additionalNotes: { type: String, default: null }, // Notas adicionales
}, { _id: false });

const equipmentSnapshotSchema = new Schema({
  equipmentType: String,
  brand: String,
  model: String,
  serialNumber: String,
  status: String,
}, { _id: false });

const contractSnapshotSchema = new Schema({
  contractId: { type: Schema.Types.ObjectId, ref: 'Contract', required: true },
  contractName: { type: String, required: true },
  maintenanceScheduleId: { type: Schema.Types.ObjectId, ref: 'MaintenanceSchedule', required: true },
  planName: { type: String, required: true },
  equipmentIds: [{ type: Schema.Types.ObjectId, ref: 'Equipment' }],
}, { _id: false });

export const workOrderSchema = new Schema<IWorkOrder>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    clientId: { type: Schema.Types.ObjectId, ref: 'Client', required: true },
    locationId: { type: Schema.Types.ObjectId, ref: 'Location', required: false },
    leadId: { type: Schema.Types.ObjectId, ref: 'Lead', default: null },
    equipmentId: { type: Schema.Types.ObjectId, ref: 'Equipment', default: null },
    quoteId: { type: Schema.Types.ObjectId, ref: 'Quote', default: null },
    clientSnapshot: { type: clientSnapshotSchema, required: true },
    locationSnapshot: { type: locationSnapshotSchema, required: true },
    equipmentSnapshot: { type: equipmentSnapshotSchema, default: null },
    contractSnapshot: { type: contractSnapshotSchema, default: null },
    // Campos adicionales para el técnico
    technicianNotes: { type: technicianNotesSchema, default: null },
    source: { type: String, enum: ['manual', 'maintenance_contract', 'lead_conversion', 'direct_sale'], required: true, default: 'manual' },
    workOrderNumber: { type: String, required: true },
    title: { type: String, required: true },
    description: String,
    priority: {
      type: String,
      enum: ['normal', 'high', 'urgent'],
      required: true,
      default: 'normal',
    },
    category: {
      type: String,
      enum: ['installation', 'maintenance', 'repair', 'inspection', 'warranty', 'emergency'],
      required: true,
    },
    status: {
      type: String,
      enum: ['draft', 'scheduled', 'in_progress', 'completed', 'cancelled'],
      required: true,
      default: 'draft',
    },
    scheduledDate: String,
    scheduledStart: Date,
    scheduledEnd: Date,
    estimatedDuration: Number,
    responseDueAt: Date,
    resolutionDueAt: Date,
    assignedTechnicians: [{ type: Schema.Types.ObjectId, ref: 'Technician' }],
    
    // Tracking de ejecución del trabajo
    startedAt: { type: Date, default: null },        // Cuándo se inició el trabajo
    startedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null }, // Quién lo inició
    finishedAt: { type: Date, default: null },       // Cuándo se terminó
    closedAt: { type: Date, default: null },        // Cuándo se cerró la OT
    duration: { type: Number, default: null },       // Duración en minutos (calculada automáticamente)
    
    // Referencia al WorkReport
    workReportId: { type: Schema.Types.ObjectId, ref: 'WorkReport', default: null },
    
    version: { type: Number, default: 0 },
    ...auditFields,
  },
  { timestamps: true }
);

workOrderSchema.index({ tenantId: 1, status: 1, scheduledDate: -1 });
workOrderSchema.index({ tenantId: 1, workOrderNumber: 1 }, { unique: true });
workOrderSchema.index({ tenantId: 1, clientId: 1, status: 1 });
workOrderSchema.index({ tenantId: 1, assignedTechnicians: 1, status: 1 });
workOrderSchema.index({ tenantId: 1, scheduledDate: 1, status: 1 });
workOrderSchema.index({ tenantId: 1, status: 1, closedAt: 1 });
workOrderSchema.index({ tenantId: 1, deletedAt: 1 });
workOrderSchema.index({ tenantId: 1, priority: 1, status: 1, scheduledDate: -1 });
