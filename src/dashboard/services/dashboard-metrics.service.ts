import { ClientModel } from '../../crm/models';
import { WorkOrderModel } from '../../operations/models';
import { QuoteModel } from '../../quotes/models';
import { ContractModel, MaintenanceScheduleModel } from '../../contracts/models';
import { LeadModel } from '../../leads/models';
import {
  SummaryResponse,
  ClientMetrics,
  WorkOrderMetrics,
  LeadMetrics,
  QuoteMetrics,
  ContractMetrics,
} from '../types/metrics';

export class DashboardMetricsService {
  async getSummary(tenantId: string): Promise<SummaryResponse> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalClients,
      newClientsThisMonth,
      clientsWithContracts,
      pendingWO,
      inProgressWO,
      completedWOMonth,
      newLeads,
      qualifiedLeads,
      sentQuotes,
      approvedQuotes,
      rejectedQuotes,
      quoteValueResult,
      activeContracts,
      expiringContracts,
      upcomingMaintenance,
    ] = await Promise.all([
      ClientModel.countDocuments({ tenantId, deletedAt: null }),
      ClientModel.countDocuments({ tenantId, deletedAt: null, createdAt: { $gte: startOfMonth } }),
      this.countClientsWithContracts(tenantId),
      WorkOrderModel.countDocuments({ tenantId, deletedAt: null, status: { $in: ['draft', 'scheduled', 'confirmed'] } }),
      WorkOrderModel.countDocuments({ tenantId, deletedAt: null, status: { $in: ['assigned', 'en_route', 'on_site', 'paused'] } }),
      WorkOrderModel.countDocuments({ tenantId, deletedAt: null, status: 'completed', updatedAt: { $gte: startOfMonth } }),
      this.countLeadsByStatus(tenantId, 'new', startOfMonth),
      this.countLeadsByStatus(tenantId, 'qualified'),
      QuoteModel.countDocuments({ tenantId, deletedAt: null, status: 'sent' }),
      QuoteModel.countDocuments({ tenantId, deletedAt: null, status: 'approved' }),
      QuoteModel.countDocuments({ tenantId, deletedAt: null, status: 'rejected' }),
      this.sumQuoteValues(tenantId),
      this.countContractsByStatus(tenantId, 'active'),
      this.countExpiringContracts(tenantId),
      this.countUpcomingSchedules(tenantId),
    ]);

    const totalLeadsConverted = newLeads > 0
      ? Math.round((qualifiedLeads / Math.max(newLeads + qualifiedLeads, 1)) * 100)
      : 0;

    const clientMetrics: ClientMetrics = {
      total: totalClients,
      newThisMonth: newClientsThisMonth,
      activeWithContracts: clientsWithContracts,
    };

    const woMetrics: WorkOrderMetrics = {
      pending: pendingWO,
      inProgress: inProgressWO,
      completedThisMonth: completedWOMonth,
      avgCompletionTimeHours: null, // Requires more complex aggregation
    };

    const leadMetrics: LeadMetrics = {
      new: newLeads,
      qualified: qualifiedLeads,
      conversionRate: totalLeadsConverted,
    };

    const quoteMetrics: QuoteMetrics = {
      sent: sentQuotes,
      approved: approvedQuotes,
      rejected: rejectedQuotes,
      totalEstimatedValue: quoteValueResult,
    };

    const contractMetrics: ContractMetrics = {
      active: activeContracts,
      expiringSoon: expiringContracts,
      upcomingMaintenance: upcomingMaintenance,
    };

    return {
      clients: clientMetrics,
      workOrders: woMetrics,
      leads: leadMetrics,
      quotes: quoteMetrics,
      contracts: contractMetrics,
      generatedAt: now.toISOString(),
    };
  }

  private async countClientsWithContracts(tenantId: string): Promise<number> {
    const result = await ContractModel.distinct('clientId', {
      tenantId,
      status: 'active',
      deletedAt: null,
    });
    return result.length;
  }

  private async countLeadsByStatus(
    tenantId: string,
    status: string,
    createdAtGte?: Date,
  ): Promise<number> {
    const filter: Record<string, unknown> = { tenantId, deletedAt: null, status };
    if (createdAtGte) {
      filter.createdAt = { $gte: createdAtGte };
    }
    return LeadModel.countDocuments(filter);
  }

  private async sumQuoteValues(tenantId: string): Promise<number> {
    const result = await QuoteModel.aggregate([
      { $match: { tenantId, deletedAt: null, status: { $in: ['sent', 'approved'] } } },
      { $group: { _id: null, total: { $sum: '$total' } } },
    ]);
    return result[0]?.total ?? 0;
  }

  private async countContractsByStatus(tenantId: string, status: string): Promise<number> {
    return ContractModel.countDocuments({ tenantId, deletedAt: null, status });
  }

  private async countExpiringContracts(tenantId: string): Promise<number> {
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    return ContractModel.countDocuments({
      tenantId,
      deletedAt: null,
      status: 'active',
      endDate: { $lte: nextMonth },
    });
  }

  private async countUpcomingSchedules(tenantId: string): Promise<number> {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    return MaintenanceScheduleModel.countDocuments({
      tenantId,
      status: 'scheduled',
      scheduledDate: { $gte: new Date(), $lte: nextWeek },
    });
  }
}
