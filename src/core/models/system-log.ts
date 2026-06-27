import mongoose, { Model } from 'mongoose';
import { ISystemLog } from '../types/system-log';
import { systemLogSchema } from '../schemas/system-log';

const SystemLogModel: Model<ISystemLog> =
  mongoose.models.SystemLog || mongoose.model<ISystemLog>(
  'SystemLog',
  systemLogSchema
);

export default SystemLogModel;
