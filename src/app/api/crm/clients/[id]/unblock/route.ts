import { NextRequest, NextResponse } from 'next/server';
import { errorMessage } from '@/core/error-message';
import mongoose from 'mongoose';
import { connectDB } from '@/core/db';
import { ClientService, ConflictError, NotFoundError } from '@/crm/services/client.service';

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

    const client = await service.unblockClient(id, tenantId, userId);

    return NextResponse.json(client);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof ConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json(
      { error: errorMessage(error, 'Internal server error') },
      { status: 500 },
    );
  }
}
