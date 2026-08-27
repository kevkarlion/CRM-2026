import mongoose, { Model } from 'mongoose';
import { IFollowUpMark } from '../types/follow-up-mark';
import { followUpMarkSchema } from '../schemas/follow-up-mark';

const FollowUpMarkModel: Model<IFollowUpMark> = mongoose.models.FollowUpMark || mongoose.model<IFollowUpMark>('FollowUpMark', followUpMarkSchema);

export default FollowUpMarkModel;
