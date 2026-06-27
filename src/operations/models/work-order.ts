import mongoose, { Model } from 'mongoose';
import { IWorkOrder } from '../types/work-order';
import { workOrderSchema } from '../schemas/work-order';

const WorkOrderModel: Model<IWorkOrder> = mongoose.models.WorkOrder || mongoose.model<IWorkOrder>('WorkOrder', workOrderSchema);

export default WorkOrderModel;
