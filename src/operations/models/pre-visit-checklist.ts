import mongoose, { Model } from 'mongoose';
import { IPreVisitChecklist } from '../types/pre-visit-checklist';
import { preVisitChecklistSchema } from '../schemas/pre-visit-checklist';

const PreVisitChecklistModel: Model<IPreVisitChecklist> =
  mongoose.models.PreVisitChecklist || mongoose.model<IPreVisitChecklist>('PreVisitChecklist', preVisitChecklistSchema);

export default PreVisitChecklistModel;
