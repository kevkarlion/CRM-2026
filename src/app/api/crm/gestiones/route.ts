import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import { GestionService, ValidationError, ConflictError } from '@/gestion/services/gestion.service';
import type { CreateGestionInput, GestionStatus, GestionSource } from '@/gestion/types/gestion';

const service = new GestionService();

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const tenantId = request.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'x-tenant-id header is required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = (searchParams.get('status') || undefined) as GestionStatus | undefined;
    const clientId = searchParams.get('clientId') || undefined;
    const assignedTo = searchParams.get('assignedTo') || undefined;
    const source = (searchParams.get('source') || undefined) as GestionSource | undefined;
    const cursor = searchParams.get('cursor') || undefined;
    const search = searchParams.get('search') || undefined;
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const isVisible = searchParams.get('isVisible') === 'true' ? true : (searchParams.get('isVisible') === 'false' ? false : undefined);
    const excludeTerminal = searchParams.get('excludeTerminal') === 'true';
    const sortByVisibleAt = searchParams.get('sortByVisibleAt') === 'true';

    const result = await service.listGestiones(
      { status, clientId, assignedTo, source, cursor, search, limit, isVisible, excludeTerminalStatuses: excludeTerminal, sortByVisibleAt },
      tenantId,
    );

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const tenantId = request.headers.get('x-tenant-id');
    const userId = request.headers.get('x-user-id');
    if (!tenantId || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json() as CreateGestionInput;
    const gestion = await service.createGestion(body, userId, tenantId);

    return NextResponse.json(gestion, { status: 201 });
  } catch (error) {
    if (error instanceof ConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}