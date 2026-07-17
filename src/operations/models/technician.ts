import { mongoose } from '@/core/db';

export const TechnicianModel = mongoose.models.Technician 
  || mongoose.model('Technician', new mongoose.Schema({}, { strict: false }), 'technicians');