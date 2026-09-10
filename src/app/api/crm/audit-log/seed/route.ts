import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import ActivityLogModel from '@/core/models/activity-log';
import LeadModel from '@/leads/models/lead';
import ClientModel from '@/crm/models/client';
import QuoteModel from '@/quotes/models/quote';
import WorkOrderModel from '@/operations/models/work-order';
import { errorMessage } from '@/core/error-message';
import { Types } from 'mongoose';

const SYSTEM_ACTOR_ID = new Types.ObjectId('000000000000000000000000');

interface SeedResult {
  entityType: string;
  totalRecords: number;
  newLogs: number;
  skipped: number;
}

function toObjectId(value: string | undefined | null): Types.ObjectId {
  if (!value) return SYSTEM_ACTOR_ID;
  try {
    return new Types.ObjectId(value);
  } catch {
    return SYSTEM_ACTOR_ID;
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const tenantId = request.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'x-tenant-id header is required' }, { status: 401 });
    }

    const body = await request.json();
    if (body.confirm !== true) {
      return NextResponse.json(
        { error: 'This is a destructive operation. Set confirm: true in the request body to proceed.' },
        { status: 400 }
      );
    }

    const results: SeedResult[] = [];

    // Seed Leads
    const leads = await LeadModel.find({ tenantId, deletedAt: null }).lean();
    const leadIds = leads.map(l => l._id);
    const existingLeadLogs = await ActivityLogModel.find({
      tenantId,
      entityType: 'lead',
      action: 'created',
      entityId: { $in: leadIds },
    }).select('entityId').lean();
    const existingLeadIds = new Set(existingLeadLogs.map(l => l.entityId.toString()));

    const newLeadLogs = leads
      .filter(l => !existingLeadIds.has(l._id.toString()))
      .map(l => ({
        tenantId: new Types.ObjectId(tenantId),
        entityType: 'lead',
        entityId: l._id,
        action: 'created' as const,
        actorId: toObjectId(l.createdBy || l.assignedTo?.toString()),
        timestamp: l.createdAt,
        metadata: {
          source: l.source || 'unknown',
          name: l.name,
          email: l.email,
          phone: l.phone,
        },
      }));

    if (newLeadLogs.length > 0) {
      await ActivityLogModel.insertMany(newLeadLogs, { ordered: false });
    }
    results.push({
      entityType: 'lead',
      totalRecords: leads.length,
      newLogs: newLeadLogs.length,
      skipped: leads.length - newLeadLogs.length,
    });

    // Seed Clients
    const clients = await ClientModel.find({ tenantId, deletedAt: null }).lean();
    const clientIds = clients.map(c => c._id);
    const existingClientLogs = await ActivityLogModel.find({
      tenantId,
      entityType: 'client',
      action: 'created',
      entityId: { $in: clientIds },
    }).select('entityId').lean();
    const existingClientIds = new Set(existingClientLogs.map(l => l.entityId.toString()));

    const newClientLogs = clients
      .filter(c => !existingClientIds.has(c._id.toString()))
      .map(c => ({
        tenantId: new Types.ObjectId(tenantId),
        entityType: 'client',
        entityId: c._id,
        action: 'created' as const,
        actorId: toObjectId(c.createdBy?.toString()),
        timestamp: c.createdAt,
        metadata: {
          name: c.fullName || c.companyName,
          email: c.email,
          phone: c.phone,
        },
      }));

    if (newClientLogs.length > 0) {
      await ActivityLogModel.insertMany(newClientLogs, { ordered: false });
    }
    results.push({
      entityType: 'client',
      totalRecords: clients.length,
      newLogs: newClientLogs.length,
      skipped: clients.length - newClientLogs.length,
    });

    // Seed Quotes
    const quotes = await QuoteModel.find({ tenantId, deletedAt: null }).lean();
    const quoteIds = quotes.map(q => q._id);
    const existingQuoteLogs = await ActivityLogModel.find({
      tenantId,
      entityType: 'quote',
      action: 'created',
      entityId: { $in: quoteIds },
    }).select('entityId').lean();
    const existingQuoteIds = new Set(existingQuoteLogs.map(l => l.entityId.toString()));

    const newQuoteLogs = quotes
      .filter(q => !existingQuoteIds.has(q._id.toString()))
      .map(q => ({
        tenantId: new Types.ObjectId(tenantId),
        entityType: 'quote',
        entityId: q._id,
        action: 'created' as const,
        actorId: toObjectId(q.createdBy?.toString()),
        timestamp: q.createdAt,
        metadata: {
          number: q.number,
          title: q.title,
          total: q.total,
          status: q.status,
        },
      }));

    if (newQuoteLogs.length > 0) {
      await ActivityLogModel.insertMany(newQuoteLogs, { ordered: false });
    }
    results.push({
      entityType: 'quote',
      totalRecords: quotes.length,
      newLogs: newQuoteLogs.length,
      skipped: quotes.length - newQuoteLogs.length,
    });

    // Seed Work Orders
    const workOrders = await WorkOrderModel.find({ tenantId, deletedAt: null }).lean();
    const workOrderIds = workOrders.map(wo => wo._id);
    const existingWorkOrderLogs = await ActivityLogModel.find({
      tenantId,
      entityType: 'workOrder',
      action: 'created',
      entityId: { $in: workOrderIds },
    }).select('entityId').lean();
    const existingWorkOrderIds = new Set(existingWorkOrderLogs.map(l => l.entityId.toString()));

    const newWorkOrderLogs = workOrders
      .filter(wo => !existingWorkOrderIds.has(wo._id.toString()))
      .map(wo => ({
        tenantId: new Types.ObjectId(tenantId),
        entityType: 'workOrder',
        entityId: wo._id,
        action: 'created' as const,
        actorId: toObjectId(wo.createdBy?.toString() || wo.assignedTechnicians?.[0]?.toString()),
        timestamp: wo.createdAt,
        metadata: {
          number: wo.workOrderNumber,
          title: wo.title,
          category: wo.category,
          priority: wo.priority,
        },
      }));

    if (newWorkOrderLogs.length > 0) {
      await ActivityLogModel.insertMany(newWorkOrderLogs, { ordered: false });
    }
    results.push({
      entityType: 'workOrder',
      totalRecords: workOrders.length,
      newLogs: newWorkOrderLogs.length,
      skipped: workOrders.length - newWorkOrderLogs.length,
    });

    const totalNewLogs = results.reduce((sum, r) => sum + r.newLogs, 0);
    const totalSkipped = results.reduce((sum, r) => sum + r.skipped, 0);

    return NextResponse.json({
      success: true,
      summary: {
        totalNewLogs,
        totalSkipped,
        byEntity: results,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, 'Failed to seed audit logs') },
      { status: 500 }
    );
  }
}
