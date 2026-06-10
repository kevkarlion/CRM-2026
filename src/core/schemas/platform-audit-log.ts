import { Schema } from 'mongoose';
import { IPlatformAuditLog } from '../types/platform-audit-log';

export const platformAuditLogSchema = new Schema<IPlatformAuditLog>({
  action: {
    type: String,
    enum: [
      'TENANT_CREATED',
      'TENANT_SUSPENDED',
      'TENANT_REACTIVATED',
      'PLAN_CHANGED',
      'CONFIG_CHANGED',
      'ADMIN_ACTION',
    ],
    required: true,
  },
  adminId: { type: Schema.Types.ObjectId, ref: 'PlatformUser', required: true },
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
  details: {
    before: { type: Schema.Types.Mixed },
    after: { type: Schema.Types.Mixed },
  },
  timestamp: { type: Date, default: Date.now },
});

// Indexes
platformAuditLogSchema.index({ tenantId: 1, timestamp: -1 });
