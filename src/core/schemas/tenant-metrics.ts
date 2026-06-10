import { Schema } from 'mongoose';
import { ITenantMetrics } from '../types/tenant-metrics';

export const tenantMetricsSchema = new Schema<ITenantMetrics>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  period: {
    type: String,
    enum: ['daily', 'weekly', 'monthly'],
    required: true,
  },
  periodStart: { type: Date, required: true },
  periodEnd: { type: Date, required: true },
  metrics: {
    userCount: { type: Number, default: 0 },
    leadCount: { type: Number, default: 0 },
    orderCount: { type: Number, default: 0 },
    quoteCount: { type: Number, default: 0 },
    errorCount: { type: Number, default: 0 },
    activityCount: { type: Number, default: 0 },
  },
  calculatedAt: { type: Date, default: Date.now },
});

// Indexes
tenantMetricsSchema.index({ tenantId: 1, period: 1, periodStart: -1 });
