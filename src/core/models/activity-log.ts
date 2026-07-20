import mongoose, { Model } from 'mongoose';
import '@/core/models/user'; // Register User model for ref resolution
import '@/core/models/tenant'; // Register Tenant model for ref resolution
import { IActivityLog } from '../types/activity-log';
import { activityLogSchema } from '../schemas/activity-log';

const ActivityLogModel: Model<IActivityLog> =
  mongoose.models.ActivityLog || mongoose.model<IActivityLog>(
  'ActivityLog',
  activityLogSchema
);

export default ActivityLogModel;
