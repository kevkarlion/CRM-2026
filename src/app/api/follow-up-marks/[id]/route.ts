import { NextRequest, NextResponse } from 'next/server';
import { errorMessage } from '@/core/error-message';
import { connectDB } from '@/core/db';
import { followUpMarkService, NotFoundError } from '@/crm/services/follow-up-mark.service';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();

    const tenantId = request.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'Se requiere el header x-tenant-id' }, { status: 401 });
    }

    const { id } = await params;

    await followUpMarkService.deleteMark(tenantId, id);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json(
      { error: errorMessage(error, 'Error interno del servidor') },
      { status: 500 }
    );
  }
}
