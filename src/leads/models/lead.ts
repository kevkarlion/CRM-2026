import mongoose, { Model } from 'mongoose';
import { ILead } from '../types/lead';
import { leadSchema } from '../schemas/lead';

const LeadModel: Model<ILead> = mongoose.models.Lead || mongoose.model<ILead>('Lead', leadSchema);

export default LeadModel;
