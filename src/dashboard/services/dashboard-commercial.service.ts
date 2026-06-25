import { QuoteModel } from '../../quotes/models';
import { LeadModel } from '../../leads/models';
import { CommercialResponse, LeadByStage, QuoteByStatus, TopClient } from '../types/metrics';

export class DashboardCommercialService {
  async getCommercialMetrics(tenantId: string): Promise<CommercialResponse> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      leadsByStage,
      newLeadsThisMonth,
      totalLeads,
      qualifiedLeads,
      quotesByStatus,
      topClients,
    ] = await Promise.all([
      this.getLeadsByStage(tenantId),
      this.countNewLeads(tenantId, startOfMonth),
      this.countAllLeads(tenantId),
      this.countQualifiedLeads(tenantId),
      this.getQuotesByStatus(tenantId),
      this.getTopClients(tenantId),
    ]);

    const conversionRate = totalLeads > 0
      ? Math.round((qualifiedLeads / totalLeads) * 100)
      : 0;

    return {
      leadsByStage,
      newLeadsThisMonth,
      conversionRate,
      quotesByStatus,
      topClients,
      generatedAt: now.toISOString(),
    };
  }

  private async getLeadsByStage(tenantId: string): Promise<LeadByStage[]> {
    const stages = await LeadModel.aggregate([
      { $match: { tenantId, deletedAt: null } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    return stages.map((s) => ({ stage: s._id, count: s.count }));
  }

  private async countNewLeads(tenantId: string, since: Date): Promise<number> {
    return LeadModel.countDocuments({
      tenantId, deletedAt: null,
      status: 'new',
      createdAt: { $gte: since },
    });
  }

  private async countAllLeads(tenantId: string): Promise<number> {
    return LeadModel.countDocuments({ tenantId, deletedAt: null });
  }

  private async countQualifiedLeads(tenantId: string): Promise<number> {
    return LeadModel.countDocuments({ tenantId, deletedAt: null, status: 'won' });
  }

  private async getQuotesByStatus(tenantId: string): Promise<QuoteByStatus[]> {
    const quotes = await QuoteModel.aggregate([
      { $match: { tenantId, deletedAt: null } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    return quotes.map((q) => ({ status: q._id, count: q.count }));
  }

  private async getTopClients(tenantId: string): Promise<TopClient[]> {
    const clients = await QuoteModel.aggregate([
      { $match: { tenantId, deletedAt: null, status: { $in: ['sent', 'approved'] } } },
      { $group: { _id: '$clientId', totalQuoted: { $sum: '$total' }, name: { $first: '$clientSnapshot.name' } } },
      { $sort: { totalQuoted: -1 } },
      { $limit: 5 },
    ]);
    return clients.map((c) => ({
      clientId: c._id.toString(),
      name: c.name || 'Unknown',
      totalQuoted: c.totalQuoted,
    }));
  }
}
