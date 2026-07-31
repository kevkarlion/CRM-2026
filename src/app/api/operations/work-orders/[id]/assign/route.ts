import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/core/db';
import { workAssignmentService } from '@/operations/services/work-assignment.service';
import WorkOrderModel from '@/operations/models/work-order';
import { requireAssignPermission } from '@/rbac/api-helpers';
import { Types } from 'mongoose';

// Helper: resolve workOrderId from param (could be _id or workOrderNumber)
async function resolveWorkOrderId(id: string, tenantId: string): Promise<string> {
  // Try as ObjectId first
  if (Types.ObjectId.isValid(id) && id.length === 24) {
    const wo = await WorkOrderModel.findOne({ _id: id, tenantId, deletedAt: null }).select('_id').lean();
    if (wo) return id;
  }
  // Try as workOrderNumber
  const woByNumber = await WorkOrderModel.findOne({ workOrderNumber: id, tenantId, deletedAt: null }).select('_id').lean();
  if (woByNumber) return String(woByNumber._id);
  // Return original - let it fail downstream
  return id;
}

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

    const workOrderId = await resolveWorkOrderId(id, tenantId);
    const data = await workAssignmentService.getCurrentAssignment(workOrderId, tenantId);
    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Check permission first
    const permCheck = await requireAssignPermission(request);
    if (permCheck.error) {
      return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
    }

    await connectDB();
    const { id } = await params;
    const tenantId = request.headers.get('x-tenant-id') || '';
    const userId = request.headers.get('x-user-id') || '';
    if (!tenantId || !userId) {
      return NextResponse.json({ error: 'x-tenant-id and x-user-id headers are required' }, { status: 400 });
    }

    // Resolve workOrderId (could be _id or workOrderNumber)
    const workOrderId = await resolveWorkOrderId(id, tenantId);

    const body = await request.json() as { action: string; technicianId?: string; oldTechnicianId?: string; newTechnicianId?: string };
    const { action } = body;

    if (!action) {
      return NextResponse.json({ error: 'action is required (assign, reassign, unassign)' }, { status: 400 });
    }

    switch (action) {
      case 'assign': {
        const { technicianId } = body;
        if (!technicianId) {
          return NextResponse.json({ error: 'technicianId is required for assign' }, { status: 400 });
        }
        
        const { Types } = await import('mongoose');
        
        // Replace technician - only 1 technician allowed per WO
        await WorkOrderModel.findByIdAndUpdate(workOrderId, {
          $set: { assignedTechnicians: [new Types.ObjectId(technicianId)] },
        });
        
        const assignment = await workAssignmentService.createAssignment(workOrderId, technicianId, userId, tenantId, {
          assignmentType: 'manual',
          reason: 'other',
        });
        return NextResponse.json({ data: assignment }, { status: 201 });
      }

      case 'reassign': {
        const { oldTechnicianId, newTechnicianId } = body;
        if (!oldTechnicianId || !newTechnicianId) {
          return NextResponse.json({ error: 'oldTechnicianId and newTechnicianId are required for reassign' }, { status: 400 });
        }
        
        const { Types } = await import('mongoose');
        
        // Replace technician - only 1 technician allowed per WO
        await WorkOrderModel.findByIdAndUpdate(workOrderId, {
          $set: { assignedTechnicians: [new Types.ObjectId(newTechnicianId)] },
        });
        
        const assignment = await workAssignmentService.replaceTechnician(workOrderId, newTechnicianId, userId, tenantId, 'replacement');
        return NextResponse.json({ data: assignment }, { status: 201 });
      }

      case 'unassign': {
        const { technicianId } = body;
        if (!technicianId) {
          return NextResponse.json({ error: 'technicianId is required for unassign' }, { status: 400 });
        }
        const current = await workAssignmentService.getCurrentAssignment(workOrderId, tenantId);
        if (current) {
          const WorkOrderAssignmentModel = (await import('@/operations/models/work-order-assignment')).default;
          await WorkOrderAssignmentModel.findByIdAndUpdate(current._id, {
            $set: { status: 'declined', declinedAt: new Date() },
          });
        }
        // Remove technician from assignedTechnicians
        const { Types } = await import('mongoose');
        await WorkOrderModel.findByIdAndUpdate(workOrderId, {
          $pull: { assignedTechnicians: new Types.ObjectId(technicianId) },
        });
        // Check if any technicians remain — if not, downgrade status to confirmed
        const wo = await WorkOrderModel.findById(id).select('assignedTechnicians status');
        const remaining = (wo?.assignedTechnicians || []).length;
        if (remaining === 0) {
          await WorkOrderModel.findByIdAndUpdate(workOrderId, {
            $set: { status: 'confirmed', updatedBy: new Types.ObjectId(userId) },
          });
        }
        return NextResponse.json({ data: { success: true } });
      }

      default:
        return NextResponse.json(
          { error: `Invalid action '${action}'. Use assign, reassign, or unassign.` },
          { status: 400 },
        );
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      error instanceof Error && error.message.includes('already') ? { status: 409 }
        : error instanceof Error && error.message.includes('not found') ? { status: 404 }
        : { status: 500 },
    );
  }
}
