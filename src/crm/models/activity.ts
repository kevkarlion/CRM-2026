import mongoose, { Model } from 'mongoose';
import { IActivity } from '../types/activity';
import { activitySchema } from '../schemas/activity';

const ActivityModel: Model<IActivity> = mongoose.model<IActivity>('Activity', activitySchema);

export default ActivityModel;
