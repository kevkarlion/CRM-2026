import { NextRequest, NextResponse } from 'next/server';
import { errorMessage } from '@/core/error-message';
import { connectDB } from '@/core/db';
import TimelineEventModel from '@/timeline/models/timeline-event';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await connectDB();
    const { id } = await params;
    const tenantId = request.headers.get('x-tenant-id') || '';
    
    if (!tenantId) {
      return NextResponse.json({ error: 'x-tenant-id header is required' }, { status: 400 });
    }

    // Resolve workOrderId from param
    const WorkOrderModel = (await import('@/operations/models/work-order')).default;
    const { Types } = await import('mongoose');
    
    let workOrderId: string;
    
    // First try to find by workOrderNumber directly
    const woByNumber = await WorkOrderModel.findOne({ workOrderNumber: id, tenantId, deletedAt: null }).select('_id workOrderNumber').lean();
    
    if (woByNumber) {
      workOrderId = String(woByNumber._id);
    } else if (Types.ObjectId.isValid(id) && id.length === 24) {
      const wo = await WorkOrderModel.findOne({ _id: id, tenantId, deletedAt: null }).select('_id').lean();
      if (wo) {
        workOrderId = id;
      } else {
        return NextResponse.json({ error: 'WorkOrder not found' }, { status: 404 });
      }
    } else {
      return NextResponse.json({ error: 'WorkOrder not found' }, { status: 404 });
    }

    // Fetch timeline events for this work order
    const events = await TimelineEventModel.find({
      tenantId,
      entityType: 'work_order',
      entityId: workOrderId,
    })
      .sort({ createdAt: 1 })
      .populate('performedBy', 'name email')
      .lean();

    return NextResponse.json({ data: events });
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, 'Internal server error') },
      { status: 500 },
    );
  }
}
