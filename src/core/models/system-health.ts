import mongoose, { Model } from 'mongoose';
import { ISystemHealth } from '../types/system-health';
import { systemHealthSchema } from '../schemas/system-health';

const SystemHealthModel: Model<ISystemHealth> = mongoose.model<ISystemHealth>(
  'SystemHealth',
  systemHealthSchema
);

export default SystemHealthModel;
