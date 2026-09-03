import { NextRequest, NextResponse } from 'next/server';
import { errorMessage } from '@/core/error-message';
import { connectDB } from '@/core/db';
import { QuoteService, NotFoundError, ConflictError, ValidationError } from '@/quotes/services';
import { TransitionError } from '@/quotes/helpers/state-machine';
import ClientModel from '@/crm/models/client';

const service = new QuoteService();

export async function POST(
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

    const result = await service.approveQuote(id, userId, tenantId);

    // Update client's operationStatus to quote_approved
    if (result.clientId) {
      await ClientModel.updateOne(
        { _id: result.clientId },
        { 
          $set: { 
            operationStatus: 'quote_approved',
            operationStatusUpdatedAt: new Date()
          }
        }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof TransitionError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    if (error instanceof ConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    return NextResponse.json(
      { error: errorMessage(error, 'Internal server error') },
      { status: 500 },
    );
  }
}
