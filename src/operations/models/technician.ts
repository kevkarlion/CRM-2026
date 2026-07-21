import { model, models, type Model } from 'mongoose';
import { ITechnician } from '../types/technician';
import { technicianSchema } from '../schemas/technician';

export const TechnicianModel: Model<ITechnician> =
  models.Technician || model<ITechnician>('Technician', technicianSchema);
