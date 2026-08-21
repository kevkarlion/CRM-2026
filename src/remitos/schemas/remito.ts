import { Schema } from 'mongoose';
import { IRemito, RemitoStatus } from '../types/remito';

export const remitoSchema = new Schema<IRemito>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    leadId: { type: Schema.Types.ObjectId, ref: 'Lead', default: null },
    clientId: { type: Schema.Types.ObjectId, ref: 'Client', default: null },
    sourceDocumentId: { type: Schema.Types.ObjectId, ref: 'Document', default: null },
    number: { type: String, required: true },
    status: {
      type: String,
      enum: ['draft', 'sent', 'delivered', 'confirmed'] satisfies RemitoStatus[],
      required: true,
      default: 'draft',
    },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 2000 },
    sentAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

remitoSchema.index({ tenantId: 1, number: 1 }, { unique: true });
remitoSchema.index({ tenantId: 1, leadId: 1 });
remitoSchema.index({ tenantId: 1, clientId: 1 });
remitoSchema.index({ tenantId: 1, status: 1 });
remitoSchema.index({ tenantId: 1, deletedAt: 1 });
remitoSchema.index({ tenantId: 1, sourceDocumentId: 1 }, { sparse: true });
remitoSchema.index({ tenantId: 1, createdAt: -1 });
