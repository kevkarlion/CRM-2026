import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/core/db';
import { QuoteService, ValidationError } from '@/quotes/services';
import type { CreateQuoteInput, QuoteStatus } from '@/quotes/types/quote';

const service = new QuoteService();

export async function GET(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'x-tenant-id header is required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get('status') || undefined;
    const status = statusParam ? statusParam.split(',').filter(Boolean) : undefined;
    const clientId = searchParams.get('clientId') || undefined;
    const search = searchParams.get('search') || undefined;
    const cursor = searchParams.get('cursor') || undefined;
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const dateFrom = searchParams.get('dateFrom') || undefined;
    const dateTo = searchParams.get('dateTo') || undefined;

    const result = await service.listQuotes({
      status: status as QuoteStatus | QuoteStatus[] | undefined,
      clientId,
      search,
      cursor,
      limit,
      createdAtGte: dateFrom,
      createdAtLte: dateTo,
    }, tenantId);

    // Bulk lookup work order statuses (best-effort, never break the list)
    let enrichedData = result.data;
    const woCount = result.data.filter(q => (q as any).convertedToWorkOrder).length;
    console.log(`[quotes-list] ${result.data.length} quotes, ${woCount} with work orders`);
    try {
      const workOrderIds = result.data
        .map(q => (q as any).convertedToWorkOrder)
        .filter(Boolean)
        .map(id => new mongoose.Types.ObjectId(String(id)));

      if (workOrderIds.length > 0) {
        const WorkOrderModel = mongoose.models.WorkOrder;
        if (WorkOrderModel) {
          const workOrders = await WorkOrderModel.find({ _id: { $in: workOrderIds } })
            .select('_id status')
            .lean();
          const workOrderStatusMap: Record<string, string> = {};
          for (const wo of workOrders) {
            workOrderStatusMap[String(wo._id)] = (wo as any).status;
          }
          enrichedData = result.data.map(q => ({
            ...q,
            workOrderStatus: workOrderStatusMap[String((q as any).convertedToWorkOrder)] ?? null,
          }));
        }
      }
    } catch (e) {
      console.error('[quotes-list] Work order enrichment failed:', e);
    }

    return NextResponse.json({ ...result, data: enrichedData });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');
    if (!tenantId || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json() as CreateQuoteInput;
    const result = await service.createQuote(body, userId, tenantId);

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
