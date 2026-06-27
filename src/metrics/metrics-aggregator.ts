import { Types } from 'mongoose';
import TenantMetricsModel from '../core/models/tenant-metrics';
import UserModel from '../core/models/user';
import { MetricsPeriod } from '../core/types/tenant-metrics';

export interface AggregateMetricsInput {
  tenantId: string | Types.ObjectId;
  period: MetricsPeriod;
  periodStart: Date;
  periodEnd: Date;
  counts: {
    userCount: number;
    leadCount: number;
    orderCount: number;
    quoteCount: number;
    errorCount: number;
    activityCount: number;
  };
}

/**
 * Creates a metrics snapshot for a tenant.
 * This is the foundation for future dashboard aggregation.
 *
 * Expected usage: scheduled job (cron) or event-driven after mutations.
 */
export async function snapshotTenantMetrics(
  input: AggregateMetricsInput
): Promise<void> {
  try {
    await TenantMetricsModel.create({
      tenantId: input.tenantId,
      period: input.period,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      metrics: {
        userCount: input.counts.userCount,
        leadCount: input.counts.leadCount,
        orderCount: input.counts.orderCount,
        quoteCount: input.counts.quoteCount,
        errorCount: input.counts.errorCount,
        activityCount: input.counts.activityCount,
      },
      calculatedAt: new Date(),
    });
  } catch (error) {
    console.error('[MetricsAggregator] Failed to persist snapshot:', error);
  }
}

/**
 * Calculates basic user count for a tenant.
 * Useful as the first metric when other business entities don't exist yet.
 */
export async function calculateUserMetrics(
  tenantId: string | Types.ObjectId
): Promise<{ userCount: number; activeUserCount: number }> {
  const [totalUsers, activeUsers] = await Promise.all([
    UserModel.countDocuments({ tenantId, deletedAt: null }),
    UserModel.countDocuments({ tenantId, deletedAt: null, status: 'active' }),
  ]);

  return {
    userCount: totalUsers,
    activeUserCount: activeUsers,
  };
}

/**
 * Returns the latest metrics snapshot for a tenant.
 */
export async function getLatestMetrics(
  tenantId: string | Types.ObjectId
) {
  return TenantMetricsModel.findOne({ tenantId })
    .sort({ calculatedAt: -1 })
    
    .exec();
}

/**
 * Returns metrics history for a tenant within a date range.
 */
export async function getMetricsHistory(
  tenantId: string | Types.ObjectId,
  period: MetricsPeriod,
  from: Date,
  to: Date
) {
  return TenantMetricsModel.find({
    tenantId,
    period,
    periodStart: { $gte: from },
    periodEnd: { $lte: to },
  })
    .sort({ periodStart: -1 })
    
    .exec();
}
