import { Schema } from 'mongoose';
import { IServiceHistory } from '../types/service-history';

const auditFields = {
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  deletedAt: { type: Date, default: null },
};

export const serviceHistorySchema = new Schema<IServiceHistory>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    equipmentId: { type: Schema.Types.ObjectId, ref: 'Equipment', required: true },
    performedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    serviceDate: { type: Date, required: true },
    serviceType: {
      type: String,
      enum: ['installation', 'maintenance', 'repair', 'diagnosis'],
      required: true,
    },
    description: String,
    observations: String,
    attachments: [{ type: Schema.Types.ObjectId, ref: 'Attachment' }],
    ...auditFields,
  },
  { timestamps: true }
);

// Indexes
serviceHistorySchema.index({ tenantId: 1, equipmentId: 1, serviceDate: -1 });
serviceHistorySchema.index({ tenantId: 1, performedBy: 1 });
