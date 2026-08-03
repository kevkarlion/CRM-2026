import { NextRequest, NextResponse } from 'next/server';
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
    if (Types.ObjectId.isValid(id) && id.length === 24) {
      const wo = await WorkOrderModel.findOne({ _id: id, tenantId, deletedAt: null }).select('_id').lean();
      if (wo) {
        workOrderId = id;
      } else {
        // Try as workOrderNumber
        const woByNumber = await WorkOrderModel.findOne({ workOrderNumber: id, tenantId, deletedAt: null }).select('_id').lean();
        if (!woByNumber) {
          return NextResponse.json({ error: 'WorkOrder not found' }, { status: 404 });
        }
        workOrderId = String(woByNumber._id);
      }
    } else {
      const woByNumber = await WorkOrderModel.findOne({ workOrderNumber: id, tenantId, deletedAt: null }).select('_id').lean();
      if (!woByNumber) {
        return NextResponse.json({ error: 'WorkOrder not found' }, { status: 404 });
      }
      workOrderId = String(woByNumber._id);
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
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
