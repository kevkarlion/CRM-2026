import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import WorkOrderModel from '@/operations/models/work-order';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const tenantId = request.headers.get('x-tenant-id');
    if (!tenantId) {
      return NextResponse.json({ error: 'x-tenant-id header is required' }, { status: 401 });
    }

    const { id } = await params;

    // Get work orders linked to this lead
    // Note: We store leadId in the work order's metadata or description
    // For now, we query by client snapshot status = 'lead'
    const workOrders = await WorkOrderModel.find({
      tenantId,
      'clientSnapshot.status': 'lead',
      deletedAt: null,
    })
      .sort({ scheduledDate: -1 })
      .limit(20)
      .exec();

    return NextResponse.json(workOrders);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
