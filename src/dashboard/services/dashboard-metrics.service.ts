import mongoose from 'mongoose';
import { ClientModel } from '../../crm/models';
import { WorkOrderModel } from '../../operations/models';
import { QuoteModel } from '../../quotes/models';
import { ContractModel, MaintenanceScheduleModel } from '../../contracts/models';
import { LeadModel } from '../../leads/models';
import { UserModel } from '../../core/models';
import {
  SummaryResponse,
  ClientMetrics,
  WorkOrderMetrics,
  LeadMetrics,
  QuoteMetrics,
  ContractMetrics,
  EmployeeMetrics,
} from '../types/metrics';

export class DashboardMetricsService {
  async getSummary(tenantId: string): Promise<SummaryResponse> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

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
      expiringSoon,
      upcomingMaintenance,
      totalEmployees,
      activeEmployees,
      avgCompletionTime,
    ] = await Promise.all([
      // Clients
      ClientModel.countDocuments({ tenantId, deletedAt: null }),
      ClientModel.countDocuments({ tenantId, deletedAt: null, createdAt: { $gte: startOfMonth } }),
      ContractModel.countDocuments({ tenantId, status: 'active', deletedAt: null }),

      // Work Orders
      WorkOrderModel.countDocuments({ tenantId, status: 'scheduled', deletedAt: null }),
      WorkOrderModel.countDocuments({
        tenantId,
        status: { $in: ['assigned', 'en_route', 'on_site', 'paused'] },
        deletedAt: null,
      }),
      WorkOrderModel.countDocuments({
        tenantId,
        status: { $in: ['completed', 'closed'] },
        updatedAt: { $gte: startOfMonth },
        deletedAt: null,
      }),

      // Leads
      LeadModel.countDocuments({ tenantId, status: 'new', deletedAt: null }),
      LeadModel.countDocuments({ tenantId, status: { $in: ['technical_visit', 'quote_sent', 'negotiation'] }, deletedAt: null }),

      // Quotes
      QuoteModel.countDocuments({ tenantId, status: 'sent', deletedAt: null }),
      QuoteModel.countDocuments({ tenantId, status: 'approved', deletedAt: null }),
      QuoteModel.countDocuments({ tenantId, status: 'rejected', deletedAt: null }),
      QuoteModel.aggregate([
        { $match: { tenantId: new mongoose.Types.ObjectId(tenantId), status: 'approved', deletedAt: null } },
        { $group: { _id: null, total: { $sum: '$total' } } },
      ]).then((r) => (r[0]?.total ?? 0)),

      // Contracts
      ContractModel.countDocuments({ tenantId, status: 'active', deletedAt: null }),
      ContractModel.countDocuments({
        tenantId,
        status: 'active',
        endDate: { $lte: thirtyDaysFromNow, $gte: now },
        deletedAt: null,
      }),
      MaintenanceScheduleModel.countDocuments({
        tenantId,
        nextDate: { $gte: now },
        deletedAt: null,
      }),

      // Employees
      UserModel.countDocuments({ tenantId, deletedAt: null }),
      UserModel.countDocuments({ tenantId, status: 'active', deletedAt: null }),

      // Average completion time (hours between creation and completion)
      WorkOrderModel.aggregate([
        {
          $match: {
            tenantId: new mongoose.Types.ObjectId(tenantId),
            status: { $in: ['completed', 'closed'] },
            deletedAt: null,
            updatedAt: { $ne: null },
            createdAt: { $ne: null },
          },
        },
        {
          $project: {
            durationHours: {
              $divide: [
                { $subtract: ['$updatedAt', '$createdAt'] },
                1000 * 60 * 60,
              ],
            },
          },
        },
        { $group: { _id: null, avg: { $avg: '$durationHours' } } },
      ]).then((r) => (r[0]?.avg !== undefined ? Math.round(r[0].avg * 10) / 10 : null)),
    ]);

    const conversionRate = newLeads > 0
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
      avgCompletionTimeHours: avgCompletionTime,
    };

    const leadMetrics: LeadMetrics = {
      new: newLeads,
      qualified: qualifiedLeads,
      conversionRate,
    };

    const quoteMetrics: QuoteMetrics = {
      sent: sentQuotes,
      approved: approvedQuotes,
      rejected: rejectedQuotes,
      totalEstimatedValue: quoteValueResult,
    };

    const contractMetrics: ContractMetrics = {
      active: activeContracts,
      expiringSoon,
      upcomingMaintenance,
    };

    const employeeMetrics: EmployeeMetrics = {
      total: totalEmployees,
      active: activeEmployees,
    };

    return {
      clients: clientMetrics,
      workOrders: woMetrics,
      leads: leadMetrics,
      quotes: quoteMetrics,
      contracts: contractMetrics,
      employees: employeeMetrics,
      generatedAt: now.toISOString(),
    };
  }
}
