import mongoose, { Model } from 'mongoose';
import { IPlatformUser } from '../types/platform-user';
import { platformUserSchema } from '../schemas/platform-user';

const PlatformUserModel: Model<IPlatformUser> =
  mongoose.models.PlatformUser || mongoose.model<IPlatformUser>(
  'PlatformUser',
  platformUserSchema
);

export default PlatformUserModel;
