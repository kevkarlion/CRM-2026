import { Schema } from 'mongoose';
import { ISecurityLog } from '../types/security-log';

export const securityLogSchema = new Schema<ISecurityLog>({
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant' },
  eventType: {
    type: String,
    enum: [
      'LOGIN_SUCCESS',
      'LOGIN_FAILED',
      'PASSWORD_CHANGED',
      'ROLE_CHANGED',
      'USER_LOCKED',
      'ACCESS_RESTORED',
    ],
    required: true,
  },
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
  ipAddress: { type: String, required: true },
  userAgent: { type: String },
  metadata: { type: Schema.Types.Mixed },
  timestamp: { type: Date, default: Date.now },
});

// Indexes
securityLogSchema.index({ tenantId: 1, eventType: 1, timestamp: -1 });
securityLogSchema.index({ userId: 1, timestamp: -1 });
