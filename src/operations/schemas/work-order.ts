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

const locationSnapshotSchema = new Schema({
  name: String,
  address: String,
  city: String,
  province: String,
  country: String,
  postalCode: String,
}, { _id: false });

const equipmentSnapshotSchema = new Schema({
  equipmentType: String,
  brand: String,
  model: String,
  serialNumber: String,
  status: String,
}, { _id: false });

export const workOrderSchema = new Schema<IWorkOrder>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    clientId: { type: Schema.Types.ObjectId, ref: 'Client', required: true },
    locationId: { type: Schema.Types.ObjectId, ref: 'Location', required: true },
    equipmentId: { type: Schema.Types.ObjectId, ref: 'Equipment', default: null },
    quoteId: { type: Schema.Types.ObjectId, ref: 'Quote', default: null },
    clientSnapshot: { type: clientSnapshotSchema, required: true },
    locationSnapshot: { type: locationSnapshotSchema, required: true },
    equipmentSnapshot: { type: equipmentSnapshotSchema, default: null },
    workOrderNumber: { type: String, required: true },
    title: { type: String, required: true },
    description: String,
    priority: {
      type: String,
      enum: ['low', 'normal', 'high', 'urgent', 'emergency'],
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
      enum: ['draft', 'scheduled', 'confirmed', 'assigned', 'en_route', 'on_site', 'paused', 'completed', 'cancelled', 'closed'],
      required: true,
      default: 'draft',
    },
    scheduledDate: Date,
    scheduledStart: Date,
    scheduledEnd: Date,
    estimatedDuration: Number,
    responseDueAt: Date,
    resolutionDueAt: Date,
    assignedTechnicians: [{ type: Schema.Types.ObjectId, ref: 'User' }],
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
workOrderSchema.index({ tenantId: 1, deletedAt: 1 });
workOrderSchema.index({ tenantId: 1, priority: 1, status: 1, scheduledDate: -1 });
