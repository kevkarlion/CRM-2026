import mongoose from 'mongoose';
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
      totalActiveLeads,
      convertedThisMonth,
      qualifiedLeads,
      quotesByStatus,
      topClients,
    ] = await Promise.all([
      this.getLeadsByStage(tenantId),
      this.countNewLeads(tenantId, startOfMonth),
      this.countAllLeads(tenantId),
      this.countConvertedThisMonth(tenantId, startOfMonth),
      this.countQualifiedLeads(tenantId),
      this.getQuotesByStatus(tenantId),
      this.getTopClients(tenantId),
    ]);

    const conversionRate = totalActiveLeads > 0
      ? Math.round((qualifiedLeads / totalActiveLeads) * 100)
      : 0;

    return {
      leadsByStage,
      newLeadsThisMonth,
      totalActiveLeads,
      convertedThisMonth,
      conversionRate,
      quotesByStatus,
      topClients,
      generatedAt: now.toISOString(),
    };
  }

  private async getLeadsByStage(tenantId: string): Promise<LeadByStage[]> {
    const tid = new mongoose.Types.ObjectId(tenantId);
    const stages = await LeadModel.aggregate([
      { $match: { tenantId: tid, deletedAt: null } },
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

  private async countConvertedThisMonth(tenantId: string, since: Date): Promise<number> {
    return LeadModel.countDocuments({
      tenantId, deletedAt: null,
      status: 'won',
      createdAt: { $gte: since },
    });
  }

  private async countQualifiedLeads(tenantId: string): Promise<number> {
    return LeadModel.countDocuments({ tenantId, deletedAt: null, status: 'won' });
  }

  private async getQuotesByStatus(tenantId: string): Promise<QuoteByStatus[]> {
    const tid = new mongoose.Types.ObjectId(tenantId);
    const quotes = await QuoteModel.aggregate([
      { $match: { tenantId: tid, deletedAt: null } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    return quotes.map((q) => ({ status: q._id, count: q.count }));
  }

  private async getTopClients(tenantId: string): Promise<TopClient[]> {
    const tid = new mongoose.Types.ObjectId(tenantId);
    const clients = await QuoteModel.aggregate([
      { $match: { tenantId: tid, deletedAt: null, status: { $in: ['sent', 'approved'] } } },
      {
        $lookup: {
          from: 'clients',
          localField: 'clientId',
          foreignField: '_id',
          as: 'client',
        },
      },
      { $unwind: { path: '$client', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$clientId',
          totalQuoted: { $sum: '$total' },
          name: { $first: { $ifNull: ['$client.companyName', { $ifNull: ['$client.fullName', 'Unknown'] }] } },
        },
      },
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
