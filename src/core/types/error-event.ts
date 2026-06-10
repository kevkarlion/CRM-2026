import { Document, Types } from 'mongoose';

export type ErrorSeverity = 'critical' | 'high' | 'medium' | 'low';
export type ErrorStatus = 'open' | 'in_progress' | 'resolved' | 'dismissed';

export interface IErrorEvent extends Document {
  _id: Types.ObjectId;
  service: string;
  severity: ErrorSeverity;
  message: string;
  stacktrace?: string;
  metadata?: Record<string, unknown>;
  tenantId?: Types.ObjectId;
  status: ErrorStatus;
  assignedTo?: Types.ObjectId;
  resolvedAt?: Date;
  timestamp: Date;
}
