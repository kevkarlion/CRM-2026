import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import { GestionService } from '@/gestion/services/gestion.service';

const service = new GestionService();

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

    // Resolve the Gestion: close current one and create new hidden one
    const newGestion = await service.resolveGestion(id, userId, tenantId);

    return NextResponse.json({
      success: true,
      previousGestionId: id,
      newGestionId: String(newGestion._id),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}