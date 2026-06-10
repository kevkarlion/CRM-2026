import { Schema } from 'mongoose';
import { IErrorEvent } from '../types/error-event';

export const errorEventSchema = new Schema<IErrorEvent>({
  service: { type: String, required: true },
  severity: {
    type: String,
    enum: ['critical', 'high', 'medium', 'low'],
    required: true,
  },
  message: { type: String, required: true },
  stacktrace: { type: String },
  metadata: { type: Schema.Types.Mixed },
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant' },
  status: {
    type: String,
    enum: ['open', 'in_progress', 'resolved', 'dismissed'],
    default: 'open',
  },
  assignedTo: { type: Schema.Types.ObjectId, ref: 'PlatformUser' },
  resolvedAt: { type: Date },
  timestamp: { type: Date, default: Date.now },
});

// Indexes
errorEventSchema.index({ tenantId: 1, status: 1 });
errorEventSchema.index({ severity: 1, status: 1, timestamp: -1 });
