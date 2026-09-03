import { NextRequest, NextResponse } from 'next/server';
import { errorMessage } from '@/core/error-message';
import { connectDB } from '@/core/db';
import LeadModel from '@/leads/models/lead';
import WorkOrderModel from '@/operations/models/work-order';
import QuoteModel from '@/quotes/models/quote';
import { Types } from 'mongoose';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await connectDB();
    const { id } = await params;
    const tenantId = request.headers.get('x-tenant-id');

    if (!tenantId) {
      return NextResponse.json({ error: 'x-tenant-id header is required' }, { status: 401 });
    }

    // Get lead with conversion info
    const lead = await LeadModel.findOne({
      _id: new Types.ObjectId(id),
      tenantId: new Types.ObjectId(tenantId),
      deletedAt: null,
    }).lean();

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // If not converted, no sale detail
    if (!lead.convertedToClient && !lead.convertedToWorkOrder) {
      return NextResponse.json({ hasSale: false });
    }

    // Find the work order
    let workOrderId = lead.convertedToWorkOrder;
    if (!workOrderId && lead.convertedToClient) {
      const wo = await WorkOrderModel.findOne({
        clientId: lead.convertedToClient,
        tenantId: new Types.ObjectId(tenantId),
        deletedAt: null,
      }).sort({ createdAt: -1 }).lean();
      workOrderId = wo?._id;
    }

    if (!workOrderId) {
      return NextResponse.json({ hasSale: false });
    }

    // Get work order details
    const workOrder = await WorkOrderModel.findById(workOrderId).lean();
    if (!workOrder) {
      return NextResponse.json({ hasSale: false });
    }

    // Find the quote (direct_sale or approved)
    const quoteQuery: Record<string, unknown>[] = [
      { clientId: lead.convertedToClient, status: { $in: ['direct_sale', 'approved'] } },
    ];
    
    if (workOrder.quoteId) {
      quoteQuery.push({ _id: workOrder.quoteId });
    }
    if (lead._id) {
      quoteQuery.push({ leadId: lead._id });
    }
    
    const quote = await QuoteModel.findOne({
      $or: quoteQuery,
      deletedAt: null,
    }).sort({ createdAt: -1 }).lean();

    return NextResponse.json({
      hasSale: true,
      workOrder: {
        _id: String(workOrder._id),
        workOrderNumber: workOrder.workOrderNumber,
        status: workOrder.status,
      },
      quote: quote ? {
        _id: String(quote._id),
        number: quote.number,
        title: quote.title,
        status: quote.status,
        total: quote.total,
        description: quote.description,
      } : null,
    });
  } catch (error) {
    console.error('[sale-detail] Error:', error);
    return NextResponse.json(
      { error: errorMessage(error, 'Internal server error') },
      { status: 500 }
    );
  }
}
