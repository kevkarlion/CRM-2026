import { Document, Types } from 'mongoose';

export type LogLevel = 'error' | 'warn' | 'info';

export interface ISystemLog extends Document {
  _id: Types.ObjectId;
  level: LogLevel;
  service: string;
  message: string;
  stacktrace?: string;
  metadata?: Record<string, unknown>;
  tenantId?: Types.ObjectId;
  timestamp: Date;
}
