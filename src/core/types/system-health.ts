import { Document, Types } from 'mongoose';

export type HealthStatus = 'healthy' | 'degraded' | 'down';

export interface ISystemHealth extends Document {
  _id: Types.ObjectId;
  serviceName: string;
  status: HealthStatus;
  responseTimeMs: number;
  details?: Record<string, unknown>;
  lastCheckAt: Date;
  createdAt: Date;
}
