import { Document, Types } from 'mongoose';

export type SecurityEventType =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'PASSWORD_CHANGED'
  | 'ROLE_CHANGED'
  | 'USER_LOCKED'
  | 'ACCESS_RESTORED';

export interface ISecurityLog extends Document {
  _id: Types.ObjectId;
  tenantId?: Types.ObjectId;
  eventType: SecurityEventType;
  userId?: Types.ObjectId;
  ipAddress: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  timestamp: Date;
}
