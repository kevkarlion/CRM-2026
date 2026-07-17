import mongoose, { Model } from 'mongoose';
import { IWorkOrderAssignment } from '../types/work-order-assignment';
import { workOrderAssignmentSchema } from '../schemas/work-order-assignment';

const WorkOrderAssignmentModel: Model<IWorkOrderAssignment> =
  mongoose.models.WorkOrderAssignment || mongoose.model<IWorkOrderAssignment>('WorkOrderAssignment', workOrderAssignmentSchema);

export default WorkOrderAssignmentModel;
export type { IWorkOrderAssignment };
