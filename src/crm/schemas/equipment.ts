import { Schema } from 'mongoose';
import { IEquipment } from '../types/equipment';

const auditFields = {
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  deletedAt: { type: Date, default: null },
};

export const equipmentSchema = new Schema<IEquipment>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    clientId: { type: Schema.Types.ObjectId, ref: 'Client', required: true },
    locationId: { type: Schema.Types.ObjectId, ref: 'Location', required: true },
    equipmentType: {
      type: String,
      enum: ['split', 'multisplit', 'boiler', 'chiller', 'rooftop', 'industrial'],
      required: true,
    },
    brand: String,
    model: String,
    serialNumber: String,
    installationDate: Date,
    warrantyExpiration: Date,
    status: {
      type: String,
      enum: ['active', 'inactive', 'under_repair', 'retired'],
      default: 'active',
    },
    notes: String,
    ...auditFields,
  },
  { timestamps: true }
);

// Indexes
equipmentSchema.index({ tenantId: 1, clientId: 1, status: 1 });
equipmentSchema.index({ tenantId: 1, locationId: 1 });
equipmentSchema.index(
  { tenantId: 1, serialNumber: 1 },
  {
    unique: true,
    partialFilterExpression: {
      deletedAt: null,
      serialNumber: { $exists: true, $ne: null },
    },
  }
);
