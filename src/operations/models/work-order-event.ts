import mongoose, { Model } from 'mongoose';
import { IWorkOrderEvent } from '../types/work-order-event';
import { workOrderEventSchema } from '../schemas/work-order-event';

const WorkOrderEventModel: Model<IWorkOrderEvent> =
  mongoose.models.WorkOrderEvent || mongoose.model<IWorkOrderEvent>('WorkOrderEvent', workOrderEventSchema);

export default WorkOrderEventModel;
