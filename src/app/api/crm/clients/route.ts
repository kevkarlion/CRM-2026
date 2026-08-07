import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import { ClientService } from '@/crm/services/client.service';
import type { ClientListFilters } from '@/crm/services/client.service';

const service = new ClientService();

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const tenantId = request.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'x-tenant-id header is required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const customerType = searchParams.get('customerType') || undefined;
    const search = searchParams.get('search') || undefined;
    const cursor = searchParams.get('cursor') || undefined;
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const result = await service.listClients(
      { status, customerType, search, cursor, limit } as ClientListFilters,
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
