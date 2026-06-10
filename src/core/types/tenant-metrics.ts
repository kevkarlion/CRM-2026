import { Document, Types } from 'mongoose';

export type MetricsPeriod = 'daily' | 'weekly' | 'monthly';

export interface ITenantMetrics extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  period: MetricsPeriod;
  periodStart: Date;
  periodEnd: Date;
  metrics: {
    userCount: number;
    leadCount: number;
    orderCount: number;
    quoteCount: number;
    errorCount: number;
    activityCount: number;
  };
  calculatedAt: Date;
}
