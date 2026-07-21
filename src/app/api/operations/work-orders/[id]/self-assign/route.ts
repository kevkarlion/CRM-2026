import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import { workAssignmentService } from '@/operations/services/work-assignment.service';
import { eventBus } from '@/infrastructure/events/event-bus';
import { DOMAIN_EVENTS } from '@/infrastructure/events/event.types';
import { TechnicianModel } from '@/operations/models/technician';
import WorkOrderModel from '@/operations/models/work-order';
import { Types } from 'mongoose';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await connectDB();
    const { id } = await params;
    const tenantId = request.headers.get('x-tenant-id') || '';
    const userId = request.headers.get('x-user-id') || '';

    if (!tenantId || !userId) {
      return NextResponse.json(
        { error: 'x-tenant-id and x-user-id headers are required' },
        { status: 400 },
      );
    }

    const body = await request.json() as {
      technicianId: string;
      reason: string;
      observations?: string;
    };

    if (!body.technicianId || !body.reason) {
      return NextResponse.json(
        { error: 'technicianId and reason are required' },
        { status: 400 },
      );
    }

    const assignment = await workAssignmentService.selfAssignTechnician(
      id,
      body.technicianId,
      tenantId,
      body.reason,
      body.observations,
    );

    // Fetch technician name and work order number for the event payload
    const [technician, workOrder] = await Promise.all([
      TechnicianModel.findOne({
        _id: new Types.ObjectId(body.technicianId),
        tenantId: new Types.ObjectId(tenantId),
      }).select('firstName lastName').lean(),
      WorkOrderModel.findOne({
        _id: new Types.ObjectId(id),
        tenantId: new Types.ObjectId(tenantId),
      }).select('workOrderNumber').lean(),
    ]);

    const technicianName = technician
      ? `${(technician as any).firstName} ${(technician as any).lastName}`.trim()
      : 'Técnico';

    try {
      await eventBus.publish({
        type: DOMAIN_EVENTS.WORK_ORDER_SELF_ASSIGNED,
        aggregateId: id,
        aggregateType: 'WorkOrder',
        tenantId,
        userId,
        timestamp: new Date(),
        payload: {
          workOrderId: id,
          technicianId: body.technicianId,
          technicianName,
          workOrderNumber: (workOrder as any)?.workOrderNumber || '',
          reason: body.reason,
        },
      });
    } catch (eventError) {
      console.error('[SelfAssign] Failed to publish WORK_ORDER_SELF_ASSIGNED:', eventError);
    }

    return NextResponse.json({ data: assignment }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      error instanceof Error && error.message.includes('not found') ? { status: 404 }
        : { status: 500 },
    );
  }
}
