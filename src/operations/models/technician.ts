import { model, type Model } from 'mongoose';
import mongoose from 'mongoose';
import { ITechnician } from '../types/technician';
import { technicianSchema } from '../schemas/technician';

export const TechnicianModel: Model<ITechnician> =
  mongoose.models.Technician || model<ITechnician>('Technician', technicianSchema);
