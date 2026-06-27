import mongoose, { Model } from 'mongoose';
import { IPlatformAuditLog } from '../types/platform-audit-log';
import { platformAuditLogSchema } from '../schemas/platform-audit-log';

const PlatformAuditLogModel: Model<IPlatformAuditLog> =
  mongoose.models.PlatformAuditLog || mongoose.model<IPlatformAuditLog>(
  'PlatformAuditLog',
  platformAuditLogSchema
);

export default PlatformAuditLogModel;
