import mongoose, { Model } from 'mongoose';
import { IActivityLog } from '../types/activity-log';
import { activityLogSchema } from '../schemas/activity-log';

const ActivityLogModel: Model<IActivityLog> = mongoose.model<IActivityLog>(
  'ActivityLog',
  activityLogSchema
);

export default ActivityLogModel;
