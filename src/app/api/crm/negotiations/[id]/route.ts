import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import { NegotiationService, TransitionError } from '@/negotiation/services/negotiation.service';
import { CounterOfferService } from '@/negotiation/services/counter-offer.service';
import type { NegotiationStatus } from '@/negotiation/types/negotiation';

const negotiationService = new NegotiationService();

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await connectDB();
    const { id } = await params;
    const tenantId = _request.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'x-tenant-id header is required' }, { status: 401 });
    }

    const negotiation = await negotiationService.findById(id, tenantId);
    if (!negotiation) {
      return NextResponse.json({ error: 'Negotiation not found' }, { status: 404 });
    }

    return NextResponse.json(negotiation);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await connectDB();
    const { id } = await params;
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');
    if (!tenantId || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    if (body.status) {
      const updated = await negotiationService.updateStatus(
        id,
        body.status as NegotiationStatus,
        userId,
        tenantId,
        body.reason,
      );
      if (!updated) {
        return NextResponse.json({ error: 'Negotiation not found' }, { status: 404 });
      }
      return NextResponse.json(updated);
    }

    if (body.counteroffer) {
      const counterOfferService = new CounterOfferService();
      const updated = await counterOfferService.addCounterOffer(id, body.counteroffer, userId, tenantId);
      return NextResponse.json(updated);
    }

    if (body.counterOfferIndex !== undefined && body.counterofferStatus) {
      const counterOfferService = new CounterOfferService();
      const updated = await counterOfferService.updateCounterOfferStatus(
        id,
        body.counterOfferIndex,
        body.counterofferStatus,
        userId,
        tenantId,
      );
      return NextResponse.json(updated);
    }

    return NextResponse.json({ error: 'No valid operation specified' }, { status: 400 });
  } catch (error) {
    if (error instanceof TransitionError) {
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
    await connectDB();
    const { id } = await params;
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');
    if (!tenantId || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const deleted = await negotiationService.softDelete(id, tenantId, userId);
    if (!deleted) {
      return NextResponse.json({ error: 'Negotiation not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
