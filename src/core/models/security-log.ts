import mongoose, { Model } from 'mongoose';
import { ISecurityLog } from '../types/security-log';
import { securityLogSchema } from '../schemas/security-log';

const SecurityLogModel: Model<ISecurityLog> = mongoose.model<ISecurityLog>(
  'SecurityLog',
  securityLogSchema
);

export default SecurityLogModel;
