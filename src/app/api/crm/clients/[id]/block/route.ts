import { NextRequest, NextResponse } from 'next/server';
import { errorMessage } from '@/core/error-message';
import mongoose from 'mongoose';
import { connectDB } from '@/core/db';
import { ClientService, ConflictError, NotFoundError, ValidationError } from '@/crm/services/client.service';

const service = new ClientService();

export async function POST(
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

    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ error: 'Invalid client id' }, { status: 400 });
    }

    await connectDB();

    const body = await request.json() as { reason?: string };
    const reason = body.reason;

    if (!reason || !reason.trim()) {
      return NextResponse.json({ error: 'Block reason is required' }, { status: 400 });
    }

    const client = await service.blockClient(id, reason, tenantId, userId);

    return NextResponse.json(client);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof ConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: errorMessage(error, 'Internal server error') },
      { status: 500 },
    );
  }
}
