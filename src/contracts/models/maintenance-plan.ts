import mongoose, { Model } from 'mongoose';
import { IMaintenancePlan } from '../types/maintenance-plan';
import { maintenancePlanSchema } from '../schemas/maintenance-plan';

const MaintenancePlanModel: Model<IMaintenancePlan> =
  mongoose.models.MaintenancePlan || mongoose.model<IMaintenancePlan>(
  'MaintenancePlan',
  maintenancePlanSchema
);

export default MaintenancePlanModel;
