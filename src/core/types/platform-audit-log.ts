import { Document, Types } from 'mongoose';

export type PlatformAuditAction =
  | 'TENANT_CREATED'
  | 'TENANT_SUSPENDED'
  | 'TENANT_REACTIVATED'
  | 'PLAN_CHANGED'
  | 'CONFIG_CHANGED'
  | 'ADMIN_ACTION';

export interface IPlatformAuditLog extends Document {
  _id: Types.ObjectId;
  action: PlatformAuditAction;
  adminId: Types.ObjectId;
  tenantId: Types.ObjectId;
  details?: {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
  };
  timestamp: Date;
}
