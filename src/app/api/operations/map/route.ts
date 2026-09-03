import { NextRequest, NextResponse } from 'next/server';
import { errorMessage } from '@/core/error-message';
import { connectDB } from '@/core/db';
import { getOperationalMapUseCase } from '@/operations/services/get-operational-map.use-case';
import { MapFilters } from '@/operations/types/map-marker';

/**
 * GET /api/operations/map
 * Get map markers for WorkOrders and TechnicalVisits
 * 
 * Query parameters:
 * - dateFrom: Start date (YYYY-MM-DD)
 * - dateTo: End date (YYYY-MM-DD)
 * - technicianId: Filter by technician ID
 * - status: Comma-separated status values
 * - serviceType: Filter by service type (category)
 * - entityType: Filter by entity type (WorkOrder, TechnicalVisit, or ALL)
 */
export async function GET(request: NextRequest) {
  try {
    await connectDB();
    
    const tenantId = request.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'x-tenant-id header is required' }, { status: 401 });
    }
    
    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    
    const filters: MapFilters = {
      dateFrom: searchParams.get('dateFrom') || undefined,
      dateTo: searchParams.get('dateTo') || undefined,
      technicianId: searchParams.get('technicianId') || undefined,
      serviceType: searchParams.get('serviceType') || undefined,
      entityType: (searchParams.get('entityType') as MapFilters['entityType']) || 'ALL',
    };
    
    // Parse status as comma-separated list
    const statusParam = searchParams.get('status');
    if (statusParam) {
      filters.status = statusParam.split(',').filter(s => s.trim());
    }
    
    // Execute the use case
    const result = await getOperationalMapUseCase.execute(tenantId, filters);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in GET /api/operations/map:', error);
    return NextResponse.json(
      { error: errorMessage(error, 'Internal server error') },
      { status: 500 }
    );
  }
}