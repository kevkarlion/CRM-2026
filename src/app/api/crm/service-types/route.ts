import { NextRequest, NextResponse } from 'next/server';
import { ServiceTypeService } from '@/service-types/services';

const service = new ServiceTypeService();

export async function GET(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'x-tenant-id header is required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';

    // Seed defaults if no service types exist
    const existing = await service.findByTenant(tenantId, true);
    if (existing.length === 0) {
      await service.seedDefaults(tenantId);
    }

    const serviceTypes = await service.findByTenant(tenantId, includeInactive);

    return NextResponse.json(serviceTypes);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'x-tenant-id header is required' }, { status: 401 });
    }

    const body = await request.json() as { name: string; description?: string };
    
    // Check if action is to seed defaults
    if (body.name === '__SEED_DEFAULTS__') {
      await service.seedDefaults(tenantId);
      return NextResponse.json({ message: 'Defaults seeded' });
    }

    const result = await service.create(body, tenantId);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
