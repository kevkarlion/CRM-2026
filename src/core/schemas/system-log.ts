import { Schema } from 'mongoose';
import { ISystemLog } from '../types/system-log';

export const systemLogSchema = new Schema<ISystemLog>({
  level: {
    type: String,
    enum: ['error', 'warn', 'info'],
    required: true,
  },
  service: { type: String, required: true },
  message: { type: String, required: true },
  stacktrace: { type: String },
  metadata: { type: Schema.Types.Mixed },
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant' },
  timestamp: { type: Date, default: Date.now },
});

// Indexes
systemLogSchema.index({ level: 1, timestamp: -1 });
systemLogSchema.index({ service: 1, timestamp: -1 });
