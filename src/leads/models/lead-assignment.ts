import mongoose, { Model } from 'mongoose';
import { ILeadAssignment } from '../types/lead-assignment';
import { leadAssignmentSchema } from '../schemas/lead-assignment';

const LeadAssignmentModel: Model<ILeadAssignment> = mongoose.models.LeadAssignment || mongoose.model<ILeadAssignment>('LeadAssignment', leadAssignmentSchema);

export default LeadAssignmentModel;
