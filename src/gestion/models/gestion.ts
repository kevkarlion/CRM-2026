import mongoose, { Model } from 'mongoose';
import { IGestion } from '../types/gestion';
import { gestionSchema } from '../schemas/gestion';

const GestionModel: Model<IGestion> = mongoose.models.Gestion || mongoose.model<IGestion>('Gestion', gestionSchema);

export default GestionModel;