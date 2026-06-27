import { Types } from 'mongoose';
import { WorkOrderModel, WorkOrderAssignmentModel } from '../models';
import { IWorkOrderAssignment } from '../types/work-order-assignment';
import { IWorkOrder } from '../types/work-order';
import { logActivity } from '../../audit/activity-logger';

export class AssignmentService {
  async assignTechnician(
    workOrderId: string,
    technicianId: string,
    tenantId: string,
    userId: string,
  ): Promise<{ assignment: IWorkOrderAssignment; workOrder: IWorkOrder }> {
    const existingAssignment = await WorkOrderAssignmentModel.findOne({
      tenantId: new Types.ObjectId(tenantId),
      workOrderId: new Types.ObjectId(workOrderId),
      technicianId: new Types.ObjectId(technicianId),
      status: { $in: ['assigned', 'acknowledged'] },
    }).exec();

    if (existingAssignment) {
      throw new Error('Technician is already assigned to this WorkOrder.');
    }

    const workOrder = await WorkOrderModel.findOne({
      _id: workOrderId, tenantId, deletedAt: null,
    }).exec();

    if (!workOrder) {
      throw new Error(`WorkOrder ${workOrderId} not found.`);
    }

    const assignment = await WorkOrderAssignmentModel.create({
      tenantId: new Types.ObjectId(tenantId),
      workOrderId: new Types.ObjectId(workOrderId),
      technicianId: new Types.ObjectId(technicianId),
      assignedBy: new Types.ObjectId(userId),
      assignedAt: new Date(),
    });

    const updatedWorkOrder = await WorkOrderModel.findOneAndUpdate(
      { _id: workOrderId, tenantId, deletedAt: null },
      { $addToSet: { assignedTechnicians: new Types.ObjectId(technicianId) } },
      { new: true },
    ).exec();

    await logActivity({
      tenantId,
      entityType: 'workOrder',
      entityId: workOrderId,
      action: 'technician.assigned',
      actorId: userId,
      metadata: {
        technicianId,
        assignmentId: String(assignment._id),
      },
    });

    return {
      assignment: assignment.toObject(),
      workOrder: updatedWorkOrder!,
    };
  }

  async unassignTechnician(
    workOrderId: string,
    technicianId: string,
    tenantId: string,
    userId: string,
  ): Promise<{ workOrder: IWorkOrder | null }> {
    const assignment = await WorkOrderAssignmentModel.findOneAndUpdate(
      {
        tenantId: new Types.ObjectId(tenantId),
        workOrderId: new Types.ObjectId(workOrderId),
        technicianId: new Types.ObjectId(technicianId),
        status: { $in: ['assigned', 'acknowledged'] },
      },
      {
        $set: {
          status: 'declined',
          declinedAt: new Date(),
        },
      },
      { new: true },
    ).exec();

    if (!assignment) {
      throw new Error(`Active assignment not found for technician ${technicianId}.`);
    }

    const updatedWorkOrder = await WorkOrderModel.findOneAndUpdate(
      { _id: workOrderId, tenantId, deletedAt: null },
      { $pull: { assignedTechnicians: new Types.ObjectId(technicianId) } },
      { new: true },
    ).exec();

    if (!updatedWorkOrder) {
      throw new Error(`WorkOrder ${workOrderId} not found.`);
    }

    await logActivity({
      tenantId,
      entityType: 'workOrder',
      entityId: workOrderId,
      action: 'technician.unassigned',
      actorId: userId,
      metadata: { technicianId },
    });

    return { workOrder: updatedWorkOrder };
  }

  async reassignTechnician(
    workOrderId: string,
    oldTechnicianId: string,
    newTechnicianId: string,
    tenantId: string,
    userId: string,
  ): Promise<{ newAssignment: IWorkOrderAssignment; workOrder: IWorkOrder }> {
    const oldAssignment = await WorkOrderAssignmentModel.findOneAndUpdate(
      {
        tenantId: new Types.ObjectId(tenantId),
        workOrderId: new Types.ObjectId(workOrderId),
        technicianId: new Types.ObjectId(oldTechnicianId),
        status: { $in: ['assigned', 'acknowledged'] },
      },
      {
        $set: {
          status: 'replaced',
          replacedAt: new Date(),
        },
      },
      { new: true },
    ).exec();

    if (!oldAssignment) {
      throw new Error(`Active assignment not found for technician ${oldTechnicianId}.`);
    }

    const newAssignment = await WorkOrderAssignmentModel.create({
      tenantId: new Types.ObjectId(tenantId),
      workOrderId: new Types.ObjectId(workOrderId),
      technicianId: new Types.ObjectId(newTechnicianId),
      assignedBy: new Types.ObjectId(userId),
      assignedAt: new Date(),
    });

    await WorkOrderAssignmentModel.updateOne(
      { _id: oldAssignment._id },
      { $set: { replacedByAssignmentId: newAssignment._id } },
    );

    const updatedWorkOrder = await WorkOrderModel.findOneAndUpdate(
      { _id: workOrderId, tenantId, deletedAt: null },
      {
        $pull: { assignedTechnicians: new Types.ObjectId(oldTechnicianId) },
        $addToSet: { assignedTechnicians: new Types.ObjectId(newTechnicianId) },
      },
      { new: true },
    ).exec();

    if (!updatedWorkOrder) {
      throw new Error(`WorkOrder ${workOrderId} not found.`);
    }

    await logActivity({
      tenantId,
      entityType: 'workOrder',
      entityId: workOrderId,
      action: 'technician.reassigned',
      actorId: userId,
      metadata: {
        fromTechnicianId: oldTechnicianId,
        toTechnicianId: newTechnicianId,
        oldAssignmentId: String(oldAssignment._id),
        newAssignmentId: String(newAssignment._id),
      },
    });

    return {
      newAssignment: newAssignment.toObject(),
      workOrder: updatedWorkOrder,
    };
  }

  async getCurrentAssignments(
    workOrderId: string,
    tenantId: string,
  ): Promise<IWorkOrderAssignment[]> {
    return WorkOrderAssignmentModel.find({
      tenantId: new Types.ObjectId(tenantId),
      workOrderId: new Types.ObjectId(workOrderId),
      status: { $in: ['assigned', 'acknowledged'] },
    })
      .sort({ assignedAt: -1 })
      
      .exec();
  }
}
