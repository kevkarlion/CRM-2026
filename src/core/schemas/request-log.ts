import { Schema } from 'mongoose';
import { IRequestLog } from '../types/request-log';

export const requestLogSchema = new Schema<IRequestLog>({
  method: { type: String, required: true },
  endpoint: { type: String, required: true },
  duration: { type: Number, required: true },
  statusCode: { type: Number, required: true },
  tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant' },
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
  ipAddress: { type: String, required: true },
  userAgent: { type: String },
  timestamp: { type: Date, default: Date.now },
});

// Indexes
requestLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 2592000 }); // 30 days TTL
requestLogSchema.index({ tenantId: 1, timestamp: -1 });
