import { Schema } from 'mongoose';
import { ISystemHealth } from '../types/system-health';

export const systemHealthSchema = new Schema<ISystemHealth>({
  serviceName: { type: String, required: true },
  status: {
    type: String,
    enum: ['healthy', 'degraded', 'down'],
    required: true,
  },
  responseTimeMs: { type: Number, required: true },
  details: { type: Schema.Types.Mixed },
  lastCheckAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now },
});

// Indexes
systemHealthSchema.index({ serviceName: 1, createdAt: -1 });
