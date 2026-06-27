import mongoose, { Model } from 'mongoose';
import { IMaintenanceSchedule } from '../types/maintenance-schedule';
import { maintenanceScheduleSchema } from '../schemas/maintenance-schedule';

const MaintenanceScheduleModel: Model<IMaintenanceSchedule> =
  mongoose.models.MaintenanceSchedule || mongoose.model<IMaintenanceSchedule>(
  'MaintenanceSchedule',
  maintenanceScheduleSchema
);

export default MaintenanceScheduleModel;
