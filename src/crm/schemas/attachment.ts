import { Schema } from 'mongoose';
import { IAttachment } from '../types/attachment';

export const attachmentSchema = new Schema<IAttachment>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    entityType: { type: String, required: true },
    entityId: { type: Schema.Types.ObjectId, required: true },
    fileName: { type: String, required: true },
    fileSize: { type: Number, required: true },
    mimeType: { type: String, required: true },
    storageProvider: { type: String, required: true },
    storagePath: { type: String, required: true },
    storageMetadata: { type: Schema.Types.Mixed },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Indexes
attachmentSchema.index({ tenantId: 1, entityType: 1, entityId: 1 });
