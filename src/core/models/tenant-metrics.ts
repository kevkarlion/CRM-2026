import mongoose, { Model } from 'mongoose';
import { ITenantMetrics } from '../types/tenant-metrics';
import { tenantMetricsSchema } from '../schemas/tenant-metrics';

const TenantMetricsModel: Model<ITenantMetrics> =
  mongoose.models.TenantMetrics || mongoose.model<ITenantMetrics>(
  'TenantMetrics',
  tenantMetricsSchema
);

export default TenantMetricsModel;
