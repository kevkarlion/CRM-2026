import { NextRequest, NextResponse } from 'next/server';
import { QuoteService, NotFoundError, ValidationError } from '@/quotes/services';
import LeadModel from '@/leads/models/lead';
import NegotiationModel from '@/negotiation/models/negotiation';
import WorkOrderModel from '@/operations/models/work-order';
import type { IQuoteItem } from '@/quotes/types/quote-version';
import type { UpdateQuoteInput } from '@/quotes/types/quote';
import type { Types } from 'mongoose';

const service = new QuoteService();

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const tenantId = _request.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'x-tenant-id header is required' }, { status: 401 });
    }

    const result = await service.getQuote(id, tenantId);

    const quote = result.quote as any;
    const currentVersion = result.currentVersion as any;
    const items: IQuoteItem[] = currentVersion?.items || [];

    const [lead, negotiation, workOrder] = await Promise.all([
      quote.leadId
        ? LeadModel.findOne({ _id: quote.leadId, tenantId })
            .select('name email phone companyName status source assignedTo pipelineStage createdAt')
            .lean()
        : Promise.resolve(null),
      NegotiationModel.findOne({ quoteId: quote._id, tenantId, isDeleted: { $ne: true } })
        .select('status counterOffers followUp createdAt updatedAt')
        .lean(),
      quote.convertedToWorkOrder
        ? WorkOrderModel.findOne({ _id: quote.convertedToWorkOrder, tenantId })
            .select('_id status')
            .lean()
        : Promise.resolve(null),
    ]);

    const leadResponse = lead
      ? {
          _id: String(lead._id),
          name: (lead as any).name,
          email: (lead as any).email,
          phone: (lead as any).phone,
          companyName: (lead as any).companyName,
          status: lead.status,
          pipelineStage: (lead as any).pipelineStage,
          origin: lead.source,
          responsible: lead.assignedTo ? String(lead.assignedTo) : undefined,
          createdAt: lead.createdAt,
        }
      : null;

    const clientResponse = quote.clientId && typeof quote.clientId === 'object'
      ? {
          _id: String(quote.clientId._id),
          fullName: (quote.clientId as any).fullName,
          companyName: (quote.clientId as any).companyName,
          email: (quote.clientId as any).email,
          phone: (quote.clientId as any).phone,
        }
      : null;

    return NextResponse.json({
      ...result,
      quote: {
        ...quote.toObject ? quote.toObject() : quote,
        items,
      },
      lead: leadResponse,
      client: clientResponse,
      negotiation: negotiation
        ? {
            _id: String(negotiation._id),
            status: negotiation.status,
            counterOffersCount: Array.isArray(negotiation.counterOffers)
              ? negotiation.counterOffers.length
              : 0,
            lastUpdate: negotiation.updatedAt,
            nextFollowUp: (negotiation as any).followUp?.nextContactDate,
          }
        : null,
      hasWorkOrder: !!workOrder,
      workOrderStatus: (workOrder as any)?.status ?? null,
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');
    if (!tenantId || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json() as UpdateQuoteInput;
    const result = await service.updateQuote(id, body, userId, tenantId);

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');
    if (!tenantId || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await service.softDelete(id, userId, tenantId);

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
